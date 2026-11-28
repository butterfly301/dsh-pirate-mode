import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMasterBackupStore, resolveClientAssetPath } from '../index.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

test('createMasterBackupStore persists and clears backup atomically with no .tmp leftovers', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-pirate-backup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const store = createMasterBackupStore({ dir });
  assert.equal(await store.read(), null);

  const sample = { 'brand-pack-loader': { id: 'pirate' }, 'dsh-window-shake': { enabled: true } };
  await store.write(sample);
  assert.deepEqual(await store.read(), sample);

  const files = await readdir(dir);
  assert.equal(files.some((f) => f.endsWith('.tmp')), false);

  await store.clear();
  assert.equal(await store.read(), null);
});

test('resolveClientAssetPath allows valid client assets and blocks path traversal', () => {
  const okJs = resolveClientAssetPath('/pirate-mode/client/panel.js');
  assert.ok(okJs && okJs.mime.includes('javascript'));
  const okCss = resolveClientAssetPath('/pirate-mode/client/styles.css');
  assert.ok(okCss && okCss.mime.includes('css'));

  assert.equal(resolveClientAssetPath('/pirate-mode/client/../index.js'), null);
  assert.equal(resolveClientAssetPath('/pirate-mode/client/%2e%2e/package.json'), null);
  assert.equal(resolveClientAssetPath('/pirate-mode/client/unknown.txt'), null);
});

test('all 8 locale files match en.json UI keys and contain zero dead keys', async () => {
  const localeDir = join(ROOT, 'locale');
  const files = (await readdir(localeDir)).filter((f) => f.endsWith('.json')).sort();
  assert.ok(files.includes('en.json'));
  assert.ok(files.includes('zh.json'));

  const enUi = JSON.parse(await readFile(join(localeDir, 'en.json'), 'utf8')).ui;
  const baseKeys = Object.keys(enUi).sort();
  for (const dead of ['pirate', 'original', 'saveFailed']) {
    assert.equal(baseKeys.includes(dead), false, `en.json must not contain dead key ${dead}`);
  }

  for (const file of files) {
    const ui = JSON.parse(await readFile(join(localeDir, file), 'utf8')).ui;
    assert.deepEqual(Object.keys(ui).sort(), baseKeys, `${file} UI keys must match en.json`);
  }
});
