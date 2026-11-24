import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PROFILE_NODE_MODULES = resolve(
  process.env.DSH_PROFILE_DIR
    ? join(process.env.DSH_PROFILE_DIR, 'node_modules')
    : join(homedir(), '.dsh/profiles/desktop/node_modules'),
);

if (!/node_modules$/.test(PROFILE_NODE_MODULES)) {
  throw new Error(`refusing to sync into ${PROFILE_NODE_MODULES}`);
}

const SUB_PACKAGES = [
  'dsh-brand-pack-loader',
  'dsh-locale-pack-loader',
  'dsh-prompt-loader',
  'dsh-rotate-status-text',
  'dsh-ocean-background',
  'dsh-window-shake',
  'dsh-sound-pack-loader',
  'dsh-confetti',
  'dsh-crew-morale',
];

const PACKAGES = ['dsh-pirate-mode', ...SUB_PACKAGES];

async function syncPackage(pkgName) {
  const srcRoot = join(WORKSPACE_ROOT, pkgName);
  const pkgJson = JSON.parse(await readFile(join(srcRoot, 'package.json'), 'utf8'));
  const target = join(PROFILE_NODE_MODULES, pkgName);

  const entries = new Set([
    ...(Array.isArray(pkgJson.files) ? pkgJson.files : []).map((entry) => {
      if (typeof entry !== 'string') return entry;
      const star = entry.indexOf('*');
      if (star === -1) return entry;
      return entry.slice(0, star).replace(/[/\\]+$/, '');
    }).filter(Boolean),
    'package.json',
  ]);
  try {
    const info = await stat(target);
    if (!info.isDirectory()) throw new Error(`target is not a directory: ${target}`);
  } catch {
    await mkdir(target, { recursive: true });
  }

  for (const entry of entries) {
    await rm(join(target, entry), { recursive: true, force: true });
  }
  for (const entry of entries) {
    const srcEntry = join(srcRoot, entry);
    try {
      await stat(srcEntry);
    } catch {
      continue;
    }
    await cp(srcEntry, join(target, entry), { recursive: true });
  }

  console.log(`synced ${pkgJson.name}@${pkgJson.version} -> ${target}`);
}

for (const pkgName of PACKAGES) {
  await syncPackage(pkgName);
}

// Remove stale nested copies inside dsh-pirate-mode/node_modules so Cordis
// resolves the synced hoisted top-level packages.
for (const subPkg of SUB_PACKAGES) {
  await rm(join(PROFILE_NODE_MODULES, 'dsh-pirate-mode', 'node_modules', subPkg), {
    recursive: true,
    force: true,
  });
}

console.log('restart or reload DeepSeek Harness to load the synced plugins');
