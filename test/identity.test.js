import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import {
  buildPromptIdentityPreview,
  buildPromptIdentitySection,
  formatHeroHeadline,
  pickLocalized,
  resolveMateName,
  resolveShipName,
  validateIdentityName,
} from '../identity.js';

const require = createRequire(import.meta.url);
const {
  loadIdentityTemplates,
  loadMessages,
  loadMoralePack,
  loadPhrases,
  loadPrompts,
  loadShakePhrases,
  loadSoundUrls,
} = require('../patch-data.cjs');

test('validateIdentityName trims whitespace, rejects newlines and >40 chars', () => {
  assert.deepEqual(validateIdentityName('  寒鸦号  '), { ok: true, value: '寒鸦号' });
  assert.equal(validateIdentityName('a\nb').ok, false);
  assert.equal(validateIdentityName('a\rb').ok, false);
  assert.equal(validateIdentityName('x'.repeat(41)).ok, false);
  assert.equal(validateIdentityName('x'.repeat(40)).ok, true);
});

test('ship name uses per-language default, custom global override, and empty string disables', () => {
  const templates = loadIdentityTemplates();
  assert.equal(resolveShipName({ shipNameOverride: false, templates }, 'zh-pirate'), '寒鸦号');
  assert.equal(resolveShipName({ shipNameOverride: false, templates }, 'en-pirate'), 'Jackdaw');
  assert.equal(resolveShipName({ shipNameOverride: false, templates }, 'zh'), '寒鸦号');
  assert.equal(resolveShipName({ shipNameOverride: '黑珍珠号', templates }, 'en-pirate'), '黑珍珠号');
  assert.equal(resolveShipName({ shipNameOverride: '', templates }, 'zh-pirate'), '');
});

test('buildPromptIdentitySection respects ship name, mate name, and language templates', () => {
  const templates = loadIdentityTemplates();
  assert.equal(
    buildPromptIdentitySection({
      identity: { shipNameOverride: false, mateName: '', templates },
      langId: 'zh-pirate',
    }),
    '你所在的船叫“寒鸦号”。',
  );
  assert.equal(
    buildPromptIdentitySection({
      identity: { shipNameOverride: '黑珍珠号', mateName: '吉布斯', templates },
      langId: 'zh',
    }),
    '你所在的船叫“黑珍珠号”。\n你的名字叫“吉布斯”。',
  );
  assert.equal(
    buildPromptIdentitySection({
      identity: { shipNameOverride: '', mateName: '', templates },
      langId: 'en-pirate',
    }),
    '',
  );
  assert.equal(resolveMateName({ mateName: '  Smee  ' }), 'Smee');
});

test('formatHeroHeadline prefixes only when pirate locale is active and uses language punctuation', () => {
  const templates = loadIdentityTemplates();
  assert.equal(
    formatHeroHeadline({
      baseText: '扬帆，启航',
      identity: { shipNameOverride: false, templates },
      langId: 'zh-pirate',
      isPirateLocale: true,
    }),
    '寒鸦号，扬帆，启航',
  );
  assert.equal(
    formatHeroHeadline({
      baseText: 'Set sail',
      identity: { shipNameOverride: 'Raven', templates },
      langId: 'en-pirate',
      isPirateLocale: true,
    }),
    'Raven, Set sail',
  );
  // Native language: hero headline must remain untouched
  assert.equal(
    formatHeroHeadline({
      baseText: '有什么可以帮你的',
      identity: { shipNameOverride: false, templates },
      langId: 'zh',
      isPirateLocale: false,
    }),
    '有什么可以帮你的',
  );
  // Empty ship name disables prefix
  assert.equal(
    formatHeroHeadline({
      baseText: '扬帆，启航',
      identity: { shipNameOverride: '', templates },
      langId: 'zh-pirate',
      isPirateLocale: true,
    }),
    '扬帆，启航',
  );
});

test('patch-data loaders load all 8 languages, morale pack, and bundled WAV URLs', () => {
  assert.equal(loadMessages().length, 8);
  assert.equal(Object.keys(loadPrompts()).length, 8);
  assert.equal(Object.keys(loadPhrases()).length, 8);
  assert.equal(Object.keys(loadShakePhrases()).length, 8);
  assert.equal(Object.keys(loadIdentityTemplates()).length, 8);

  const morale = loadMoralePack();
  assert.equal(morale.commandName, 'rum');
  assert.equal(Object.keys(morale.protestPhrases).length, 8);
  assert.equal(Object.keys(morale.rumPhrases).length, 8);

  const sounds = loadSoundUrls();
  assert.equal(sounds.completed, '/pirate-mode/sounds/ship-bell.wav');
  assert.equal(sounds.failed, '/pirate-mode/sounds/ship-horn.wav');
  assert.equal(sounds.waiting, '/pirate-mode/sounds/bosun-pipe.wav');

  const moraleNoDup = loadMoralePack();
  assert.deepEqual(moraleNoDup.confetti, {});
});

test('pickLocalized prefers English before first entry and preview matches prompt section', () => {
  const templates = loadIdentityTemplates();
  assert.equal(pickLocalized({ 'de-pirate': 'DE', 'en-pirate': 'EN', 'zh-pirate': 'ZH' }, 'ko'), 'EN');
  assert.equal(pickLocalized({ 'de-pirate': 'DE', 'en-pirate': 'EN' }, undefined), 'EN');

  const opts = {
    identity: { shipNameOverride: 'Raven', mateName: 'Gibbs', templates },
    langId: 'en-pirate',
  };
  assert.equal(buildPromptIdentityPreview(opts), buildPromptIdentitySection(opts));
});

test('empty identity.templates merges fallbackTemplates cleanly for hero and system prompt', () => {
  const fallbackTemplates = loadIdentityTemplates();
  const savedIdentity = { shipNameOverride: '拉夫勒尔号', mateName: '埃皮纳', templates: {} };
  assert.equal(
    formatHeroHeadline({
      baseText: '启航！',
      identity: savedIdentity,
      fallbackTemplates,
      langId: 'zh-pirate',
      isPirateLocale: true,
    }),
    '拉夫勒尔号，启航！',
  );
  assert.equal(
    buildPromptIdentitySection({
      identity: savedIdentity,
      fallbackTemplates,
      langId: 'zh-pirate',
    }),
    '你所在的船叫“拉夫勒尔号”。\n你的名字叫“埃皮纳”。',
  );
});

test('client applies hero ship prefix synchronously before dynamic import and publishes revision when forms settle', () => {
  const clientCode = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
  let loadedMod = null;
  const fakeReact = {
    createElement: (...args) => ({ args }),
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useEffect: () => {},
  };
  const sandbox = {
    window: {
      __ModuleLoader__: { load(m) { loadedMod = m; } },
      localStorage: { getItem: () => '1', setItem: () => {} },
    },
    document: {
      createElement: () => ({ setAttribute() {}, remove() {} }),
      head: { appendChild() {} },
    },
    console,
  };
  vm.runInNewContext(clientCode, sandbox);

  let activeLang = 'zh-pirate';
  let publishedCount = 0;
  const locale = {
    getSnapshot: () => ({ active: activeLang }),
    publish: () => { publishedCount += 1; },
    translate: (_ns, key) => (key === 'hero.headline' ? '启航！' : key),
  };

  const subs = new Map();
  const snaps = {
    'pirate-mode': { status: 'loading', value: undefined, base: {} },
    'locale-pack-loader': { status: 'loading', value: undefined, base: {} },
  };
  const makeForm = (ns) => ({
    getSnapshot: () => snaps[ns] || { status: 'ready', value: {}, base: {} },
    subscribe: (fn) => {
      if (!subs.has(ns)) subs.set(ns, new Set());
      subs.get(ns).add(fn);
      return () => subs.get(ns).delete(fn);
    },
  });

  const ctx = {
    locale,
    configForms: { get: (ns) => makeForm(ns) },
    slots: { inject: () => () => {}, register: () => () => {} },
    remote: { settings: {} },
    effect: (fn) => fn(),
  };

  const stop = loadedMod.factory((id) => (id === 'react' ? fakeReact : null)).apply(ctx);
  assert.equal(locale.translate('conversation', 'hero.headline'), '启航！');

  snaps['locale-pack-loader'] = { status: 'ready', value: { packs: [{ id: 'zh-pirate' }] }, base: {} };
  snaps['pirate-mode'] = {
    status: 'ready',
    value: { identity: { shipNameOverride: '拉夫勒尔号', mateName: '埃皮纳', templates: {} } },
    base: {},
  };
  for (const fn of subs.get('pirate-mode') || []) fn();
  assert.ok(publishedCount >= 1);
  assert.equal(locale.translate('conversation', 'hero.headline'), '拉夫勒尔号，启航！');

  activeLang = 'zh';
  assert.equal(locale.translate('conversation', 'hero.headline'), '启航！');
  stop?.();
});
