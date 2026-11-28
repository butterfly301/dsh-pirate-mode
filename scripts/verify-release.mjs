import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

const RELEASE_PACKAGES = [
  'dsh-brand-pack-loader',
  'dsh-locale-pack-loader',
  'dsh-prompt-loader',
  'dsh-rotate-status-text',
  'dsh-ocean-background',
  'dsh-window-shake',
  'dsh-sound-pack-loader',
  'dsh-confetti',
  'dsh-crew-morale',
  'dsh-pirate-mode',
];

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor']);

async function walkJsFiles(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walkJsFiles(join(dir, entry.name), out);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs')) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

let failures = 0;
function fail(msg) {
  failures += 1;
  console.error(`FAIL: ${msg}`);
}

for (const pkgName of RELEASE_PACKAGES) {
  const pkgRoot = join(WORKSPACE_ROOT, pkgName);
  const pkgJsonPath = join(pkgRoot, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
  } catch (err) {
    fail(`${pkgName}: invalid package.json (${err.message})`);
    continue;
  }

  for (const field of ['repository', 'homepage', 'bugs', 'publishConfig']) {
    if (!pkg[field]) fail(`${pkgName}: missing package.json.${field}`);
  }
  if (!Array.isArray(pkg.keywords) || pkg.keywords.length === 0) {
    fail(`${pkgName}: missing package.json.keywords`);
  }
  if (!pkg.engines?.dsh) {
    fail(`${pkgName}: missing package.json.engines.dsh`);
  }
  if (!['dsh-brand-pack-loader', 'dsh-locale-pack-loader'].includes(pkgName) && !pkg.engines?.node) {
    fail(`${pkgName}: missing package.json.engines.node`);
  }
  const bundlePatch = pkg.dsh?.bundle?.patch;
  if (typeof bundlePatch !== 'string' || bundlePatch === '') {
    fail(`${pkgName}: missing package.json.dsh.bundle.patch`);
  } else {
    try {
      const info = await stat(join(pkgRoot, bundlePatch));
      if (!info.isFile()) fail(`${pkgName}: bundle patch is not a file (${bundlePatch})`);
    } catch {
      fail(`${pkgName}: missing bundle patch ${bundlePatch}`);
    }
  }
  if (pkg.dependencies) {
    for (const [dep, ver] of Object.entries(pkg.dependencies)) {
      if (ver === 'latest' || ver === '*') {
        fail(`${pkgName}: unpinned dependency ${dep}: ${ver}`);
      }
    }
  }

  try {
    const licInfo = await stat(join(pkgRoot, 'LICENSE'));
    if (licInfo.size < 500) fail(`${pkgName}: LICENSE appears incomplete (${licInfo.size} bytes)`);
  } catch {
    fail(`${pkgName}: missing LICENSE`);
  }

  const scripts = await walkJsFiles(pkgRoot);
  for (const file of scripts) {
    try {
      await execFileAsync(process.execPath, ['--check', file]);
    } catch (err) {
      fail(`${relative(WORKSPACE_ROOT, file)}: syntax error\n${err.stderr || err.message}`);
    }
  }

  if (pkg.scripts?.test) {
    try {
      const { stdout } = await execFileAsync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        ['test'],
        { cwd: pkgRoot, shell: process.platform === 'win32' },
      );
      console.log(`PASS test: ${pkgName}`);
      if (process.env.VERBOSE) console.log(stdout);
    } catch (err) {
      fail(`${pkgName}: npm test failed\n${err.stdout || ''}\n${err.stderr || err.message}`);
    }
  }
}

const pmRoot = join(WORKSPACE_ROOT, 'dsh-pirate-mode');
const localeFiles = (await readdir(join(pmRoot, 'locale'))).filter((f) => f.endsWith('.json')).sort();
if (!localeFiles.includes('en.json') || !localeFiles.includes('zh.json')) {
  fail('dsh-pirate-mode: missing en.json or zh.json');
}
const enUi = JSON.parse(await readFile(join(pmRoot, 'locale/en.json'), 'utf8')).ui || {};
const enKeys = new Set(Object.keys(enUi));
for (const file of localeFiles) {
  const ui = JSON.parse(await readFile(join(pmRoot, 'locale', file), 'utf8')).ui || {};
  const keys = new Set(Object.keys(ui));
  const missing = [...enKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !enKeys.has(k));
  if (missing.length || extra.length) {
    fail(`dsh-pirate-mode/locale/${file}: key mismatch missing=${missing.join(',')} extra=${extra.join(',')}`);
  }
}
for (const dead of ['pirate', 'original', 'saveFailed']) {
  if (enKeys.has(dead)) fail(`dsh-pirate-mode/locale/en.json still contains dead key "${dead}"`);
}

const CONTRACT_EVENTS = [
  'dsh:window-shake',
  'dsh:status-text:override',
  'dsh:confetti',
  'dsh:sound-pack-loader:preview',
  'dsh:sound-pack-loader:updated',
  'dsh:ocean-flag-changed',
];
const CONTRACT_ROUTES = [
  '/ocean-background/flag',
  '/ocean-background/flag/image',
  '/sound-pack-loader/custom',
];
const CONTRACT_PREFIX_ROUTES = new Set(['/sound-pack-loader/custom']);
const CONTRACT_NAMESPACES = [
  'pirate-mode',
  'brand-pack-loader',
  'locale-pack-loader',
  'dsh-rotate-status-text',
  'prompt-loader',
  'dsh-sound-pack-loader',
  'dsh-confetti',
  'dsh-crew-morale',
  'dsh-window-shake',
  'locale',
];

async function walkSourceFiles(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'vendor' || entry.name === 'test') continue;
      await walkSourceFiles(join(dir, entry.name), out);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs')) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const contractFiles = [];
for (const pkgName of RELEASE_PACKAGES) {
  await walkSourceFiles(join(WORKSPACE_ROOT, pkgName), contractFiles);
}
const seenEvents = new Set();
const seenRoutes = new Set();
const seenNamespaces = new Set();
for (const file of contractFiles) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/['"`](dsh:[^'"`\s]+)['"`]/gu)) {
    const value = match[1];
    if (!CONTRACT_EVENTS.includes(value)) {
      fail(`${relative(WORKSPACE_ROOT, file)}: unknown event ${value}`);
    } else {
      seenEvents.add(value);
    }
  }
  for (const match of text.matchAll(/['"`](\/(?:ocean-background\/flag|sound-pack-loader\/custom)[^'"`\s]*)['"`]/gu)) {
    const value = match[1];
    if (CONTRACT_ROUTES.includes(value)) {
      seenRoutes.add(value);
    } else {
      const prefix = [...CONTRACT_PREFIX_ROUTES].find((route) => value.startsWith(`${route}/`) || value.startsWith(`${route}?`));
      if (!prefix) fail(`${relative(WORKSPACE_ROOT, file)}: unknown route ${value}`);
      else seenRoutes.add(prefix);
    }
  }
  for (const match of text.matchAll(/configForms\.get\(\s*'([^']+)'\s*\)/gu)) {
    const value = match[1];
    if (!CONTRACT_NAMESPACES.includes(value)) fail(`${relative(WORKSPACE_ROOT, file)}: unknown namespace ${value}`);
    else seenNamespaces.add(value);
  }
  for (const match of text.matchAll(/readSettingsDoc\([^,]+,\s*'([^']+)'/gu)) {
    const value = match[1];
    if (!CONTRACT_NAMESPACES.includes(value)) fail(`${relative(WORKSPACE_ROOT, file)}: unknown namespace ${value}`);
    else seenNamespaces.add(value);
  }
}
for (const value of CONTRACT_EVENTS) if (!seenEvents.has(value)) fail(`contract event unused: ${value}`);
for (const value of CONTRACT_ROUTES) if (!seenRoutes.has(value)) fail(`contract route unused: ${value}`);
for (const value of CONTRACT_NAMESPACES) {
  const literal = `'${value}'`;
  const used = contractFiles.length > 0 && (await Promise.all(contractFiles.map((file) => readFile(file, 'utf8'))))
    .some((text) => text.includes(literal));
  if (!used) fail(`contract namespace unused: ${value}`);
}

if (failures > 0) {
  console.error(`\nverify-release: ${failures} check(s) failed`);
  process.exit(1);
}
console.log(`\nverify-release: all ${RELEASE_PACKAGES.length} release packages passed.`);
