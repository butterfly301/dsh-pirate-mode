import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommitPlan,
  buildDisablePatches,
  buildRestorePatches,
  captureMasterBackup,
  computeMasterOn,
} from '../client/adapters.js';
import { collectLanguageOptions } from '../client/helpers.js';

function makeFormStore(initialMap) {
  const store = {};
  for (const [id, entry] of Object.entries(initialMap)) {
    store[id] = {
      status: 'ready',
      revision: 1,
      value: structuredClone(entry.value),
      base: structuredClone(entry.base ?? entry.value),
    };
  }
  const forms = {};
  for (const id of Object.keys(store)) {
    forms[id] = { getSnapshot: () => store[id] };
  }
  const valueOf = (id) => store[id]?.value || {};
  const baseOf = (id) => store[id]?.base || {};
  const applyPatches = (patches) => {
    for (const [id, patch] of Object.entries(patches)) {
      if (store[id]) store[id].value = { ...store[id].value, ...patch };
    }
  };
  return { forms, valueOf, baseOf, applyPatches };
}

test('master backup capture, disable (including window-shake), and restore round-trip preserves custom user edits', () => {
  const { forms, valueOf, baseOf, applyPatches } = makeFormStore({
    'pirate-mode': { value: { identity: { shipNameOverride: 'CustomShip', mateName: 'Smee', templates: {} } } },
    'brand-pack-loader': { value: { pack: { id: 'pirate', sidebarMark: 'data:image/png;base64,AAA', heroMark: false, wordmark: false } } },
    'locale-pack-loader': { value: { packs: [{ id: 'zh-pirate', label: '海盗中文', fallback: 'zh', dictionaries: {} }], pack: false } },
    'dsh-rotate-status-text': {
      value: {
        pack: {
          intervalMs: 12000,
          thresholds: [20, 50],
          phrases: { 'zh-pirate': { start: ['A'], progress: ['B'], long: ['C'] } },
          shakePhrases: { 'zh-pirate': ['别摇了'] },
        },
      },
    },
    'prompt-loader': { value: { pack: { texts: { 'zh-pirate': 'Custom prompt' } } } },
    'dsh-sound-pack-loader': { value: { muted: false, volume: 0.7, triggerMode: 'always', events: { completed: true, failed: true, waiting: true }, pack: { sounds: {} } } },
    'dsh-confetti': { value: { pack: { colors: ['#fff'], particleCount: 50, spread: 70, originY: 0.65 } } },
    'dsh-crew-morale': {
      value: {
        initial: 100,
        pack: {
          commandName: 'rum',
          commandDescription: { 'zh-pirate': '干杯' },
          protestPhrases: { 'zh-pirate': ['抗议'] },
          retryPhrases: {},
          failedPhrases: {},
          cancelledPhrases: {},
          rumPhrases: { 'zh-pirate': ['乾杯'] },
        },
      },
    },
    'dsh-window-shake': { value: { enabled: true, cooldownMs: 60000 } },
  });

  assert.equal(computeMasterOn(valueOf), true);
  const backup = captureMasterBackup({
    valueOf,
    phraseDrafts: {},
    shakeDrafts: {},
    intervalDraft: null,
    thresholdDrafts: null,
    moraleTextDrafts: {},
  });
  assert.equal(backup['dsh-window-shake'].enabled, true);
  assert.equal(backup['dsh-rotate-status-text'].intervalMs, 12000);

  applyPatches(buildDisablePatches());
  assert.equal(computeMasterOn(valueOf), false);
  assert.equal(valueOf('dsh-window-shake').enabled, false);

  applyPatches(buildRestorePatches({ saved: backup, baseOf }));
  assert.equal(computeMasterOn(valueOf), true);
  assert.equal(valueOf('dsh-window-shake').enabled, true);
  assert.equal(valueOf('dsh-rotate-status-text').pack.intervalMs, 12000);
  assert.equal(valueOf('prompt-loader').pack.texts['zh-pirate'], 'Custom prompt');
  assert.deepEqual(valueOf('dsh-crew-morale').pack.protestPhrases['zh-pirate'], ['抗议']);

  const { opsByNs } = buildCommitPlan({
    forms,
    valueOf,
    baseOf,
    savedBackup: backup,
    phraseDrafts: {},
    shakeDrafts: { 'zh-pirate': '新摇晃吐槽' },
    intervalDraft: null,
    thresholdDrafts: null,
    moraleTextDrafts: { 'zh-pirate': { rumPhrases: '新乾杯语' } },
    shipNameDraft: undefined,
    mateNameDraft: undefined,
    locale: { getSnapshot: () => ({ active: 'zh-pirate' }) },
    t: (k) => k,
  });

  assert.ok(opsByNs['dsh-rotate-status-text'].some((op) => op.path.join('.') === 'pack.shakePhrases.zh-pirate'));
  assert.ok(opsByNs['dsh-crew-morale'].some((op) => op.path.join('.') === 'pack.rumPhrases.zh-pirate'));
});

test('collectLanguageOptions includes shakePhrases and morale pack languages', () => {
  const opts = collectLanguageOptions([], {}, {}, { 'ja-pirate': ['揺らすな'] }, { rumPhrases: { 'fr-pirate': ['Rhum!'] } });
  const ids = opts.map((o) => o.id);
  assert.ok(ids.includes('ja-pirate'));
  assert.ok(ids.includes('fr-pirate'));
});
