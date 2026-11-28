import test from 'node:test';
import assert from 'node:assert/strict';
import { readService as readPirate } from '../index.js';
import { readService as readMorale, pickLocalized as pickMorale } from '../../dsh-crew-morale/index.js';
import { readService as readSound } from '../../dsh-sound-pack-loader/index.js';
import { readService as readRotate } from '../../dsh-rotate-status-text/host/turn-state.js';
import { readService as readOcean } from '../../dsh-ocean-background/host/session-state.js';
import { pickLocalized as pickPrompt } from '../../dsh-prompt-loader/index.js';

const readers = [readPirate, readMorale, readSound, readRotate, readOcean];

const makeCtx = () => ({
  get(key) {
    if (key === 'direct') return 1;
    if (key === 'boom') throw new Error('get failed');
    return undefined;
  },
  reflect: {
    get(key) {
      if (key === 'reflected') return 2;
      return undefined;
    },
  },
});

test('readService copies agree on direct, reflected, missing, and throwing reads', () => {
  for (const read of readers) {
    const ctx = makeCtx();
    assert.equal(read(ctx, 'direct'), 1);
    assert.equal(read(ctx, 'missing'), undefined);
    assert.equal(read(ctx, 'boom'), undefined);
    assert.equal(read(undefined, 'missing'), undefined);
    const reflected = { reflect: { get: (key) => (key === 'reflected' ? 2 : undefined) } };
    assert.equal(read(reflected, 'reflected'), 2);
    assert.equal(read(reflected, 'missing'), undefined);
  }
});

test('text-family pickLocalized copies agree on trim and fallback order', () => {
  const maps = [
    { 'zh-pirate': '  中文  ', en: 'English' },
    { 'zh-pirate': '   ', en: 'English' },
    { 'zh-hant': '繁體', en: 'English' },
    { 'zh-pirate': '', 'zh-hant': '繁體', en: 'English' },
    {},
    null,
  ];
  const prefs = ['zh-pirate', 'zh-CN', 'ja', undefined];
  for (const map of maps) {
    for (const preference of prefs) {
      assert.equal(pickPrompt(map, preference), pickMorale(map, preference));
    }
  }
});
