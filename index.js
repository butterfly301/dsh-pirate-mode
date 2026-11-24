// Host entry for dsh-pirate-mode. Serves read-only UI dictionaries, client ESM
// modules, identity helpers, default flag image, and atomic master-switch backup
// storage, and injects the ship/mate identity section into systemPrompt.

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPromptIdentitySection, pickLocalized } from './identity.js';

const localRequire = createRequire(import.meta.url);
const hostRoot = process.env.DSH_INSTALL_DIR
  ?? (process.resourcesPath && join(process.resourcesPath, 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh'));
function loadSchemastery() {
  try {
    return hostRoot
      ? createRequire(join(hostRoot, 'package.json'))('@deepseek-ai/schemastery')
      : localRequire('@deepseek-ai/schemastery');
  } catch (err) {
    if (err?.code !== 'MODULE_NOT_FOUND' || !String(err.message).includes('@deepseek-ai/schemastery')) {
      throw err;
    }
    const chain = () => ({ default: chain, min: chain, max: chain, volatile: chain });
    return { object: chain, string: chain, number: chain, boolean: chain, array: chain, dict: chain, union: chain, const: chain };
  }
}
const schemastery = loadSchemastery();
const z = schemastery.default ?? schemastery;

const templateSchema = z.object({
  defaultShipName: z.string().default(''),
  heroPrefixTemplate: z.string().default('{shipName}, {headline}'),
  promptShipTemplate: z.string().default(''),
  promptMateTemplate: z.string().default(''),
});

const identitySchema = z.object({
  shipNameOverride: z.union([z.const(false), z.string()]).default(false),
  mateName: z.string().default(''),
  templates: z.dict(templateSchema).default({}),
});

export const Config = z.object({
  identity: identitySchema.default({}).volatile(),
});

export const name = 'pirate-mode';

const ROUTE = '/pirate-mode/locale';
const PREFIX = `${ROUTE}/`;
const DEFAULT_FLAG_ROUTE = '/pirate-mode/default-flag.png';
const IDENTITY_ROUTE = '/pirate-mode/identity.js';
const IDENTITY_TEMPLATES_ROUTE = '/pirate-mode/identity-templates.json';
const CLIENT_ROUTE = '/pirate-mode/client';
const CLIENT_PREFIX = `${CLIENT_ROUTE}/`;
const BACKUP_ROUTE = '/pirate-mode/master-backup';
const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

let BUNDLED_IDENTITY_TEMPLATES = {};
try {
  BUNDLED_IDENTITY_TEMPLATES = localRequire('./patch-data.cjs').loadIdentityTemplates() || {};
} catch {}

const DEFAULT_FLAG_PATH = resolve(fileURLToPath(new URL('./assets/default-flag.png', import.meta.url)));
const IDENTITY_PATH = resolve(fileURLToPath(new URL('./identity.js', import.meta.url)));
const CLIENT_ROOT = resolve(fileURLToPath(new URL('./client/', import.meta.url)));
const LOCALE_ROOT = resolve(fileURLToPath(new URL('./locale/', import.meta.url)));
const LANG_RE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

const CLIENT_MIME = Object.freeze({
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
});

const unwrap = (field) => (field && typeof field.get === 'function' ? field.get() : field);

function readService(ctx, key) {
  try {
    if (typeof ctx?.get === 'function') return ctx.get(key);
    if (ctx?.reflect && typeof ctx.reflect.get === 'function') return ctx.reflect.get(key);
  } catch {}
  return undefined;
}

function dataDirOf(ctx) {
  const homePath = readService(ctx, 'dshHomePath');
  if (typeof homePath === 'function') {
    try {
      const resolved = homePath('pirate-mode');
      if (typeof resolved === 'string' && resolved !== '') return resolved;
    } catch {}
  }
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'pirate-mode');
}

function send(req, res, status, body, contentType, cacheControl) {
  const buf = body ? Buffer.from(body) : undefined;
  const headers = { 'x-content-type-options': 'nosniff' };
  if (contentType) headers['content-type'] = contentType;
  if (buf) headers['content-length'] = String(buf.byteLength);
  if (cacheControl) headers['cache-control'] = cacheControl;
  else if (status === 200) headers['cache-control'] = 'public, max-age=3600';
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}

function readJsonBody(req, limitBytes) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      rejectPromise(error);
    };
    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limitBytes) {
        const err = new Error('backup payload too large');
        err.status = 413;
        fail(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        const err = new Error('invalid json');
        err.status = 400;
        rejectPromise(err);
      }
    });
    req.on('error', fail);
  });
}

export function createMasterBackupStore({ dir }) {
  const filePath = dir ? join(dir, 'master-backup.json') : null;
  return {
    async read() {
      if (!filePath) return null;
      try {
        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    async write(backup) {
      if (!filePath || !dir) throw new Error('backup storage unavailable');
      if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
        const err = new Error('invalid backup object');
        err.status = 400;
        throw err;
      }
      await mkdir(dir, { recursive: true });
      const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, JSON.stringify(backup, null, 2) + '\n', 'utf8');
      await rename(tmp, filePath);
      return backup;
    },
    async clear() {
      if (!filePath) return;
      try {
        await unlink(filePath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    },
  };
}

export function resolveClientAssetPath(pathname) {
  if (!pathname.startsWith(CLIENT_PREFIX)) return null;
  let rel;
  try {
    rel = decodeURIComponent(pathname.slice(CLIENT_PREFIX.length));
  } catch {
    return null;
  }
  if (!rel || rel.includes('\0')) return null;
  const target = resolve(CLIENT_ROOT, rel);
  if (!target.startsWith(`${CLIENT_ROOT}${sep}`)) return null;
  const mime = CLIENT_MIME[extname(target)];
  if (!mime) return null;
  return { target, mime };
}

async function readLocaleUi(lang) {
  const candidates = [];
  const lower = lang.toLowerCase();
  const primary = lower.split('-')[0];
  candidates.push(lower);
  if (primary && primary !== lower) candidates.push(primary);
  if (!candidates.includes('en')) candidates.push('en');

  for (const id of candidates) {
    try {
      const raw = await readFile(join(LOCALE_ROOT, `${id}.json`), 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data.ui === 'object' && data.ui) {
        return { lang: id, ui: data.ui };
      }
    } catch {}
  }
  return null;
}

function readSettingsEntry(settings, ns) {
  try {
    const entries = typeof settings?.describe === 'function' ? settings.describe() : [];
    return entries.find((entry) => String(entry?.ns) === ns);
  } catch {
    return undefined;
  }
}

function isPersonaActive(settings, preference) {
  const promptEntry = readSettingsEntry(settings, 'prompt-loader');
  const pack = promptEntry?.value?.pack;
  if (!pack || typeof pack !== 'object') return false;
  const texts = pack.texts;
  if (!texts || typeof texts !== 'object') return false;
  const picked = pickLocalized(texts, preference);
  return typeof picked === 'string' && picked.trim().length > 0;
}

export function apply(ctx, config = {}) {
  ctx.inject(['settings'], (scope) => scope.effect(
    () => scope.settings.configure({ auto: false }, ctx.fiber),
  ));

  ctx.inject(['webServer'], (scope) => scope.effect(() => {
    const backupStore = createMasterBackupStore({ dir: dataDirOf(scope) });

    const unregisterLocale = scope.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405);
        let url;
        try {
          url = new URL(req.url ?? ROUTE, 'http://dsh.local');
        } catch {
          return send(req, res, 400);
        }
        if (!url.pathname.startsWith(PREFIX) || !url.pathname.endsWith('.json')) {
          return send(req, res, 404);
        }
        const rawLang = url.pathname.slice(PREFIX.length, -5);
        let lang;
        try {
          lang = decodeURIComponent(rawLang);
        } catch {
          return send(req, res, 400);
        }
        if (!LANG_RE.test(lang)) return send(req, res, 400);
        const payload = await readLocaleUi(lang);
        if (!payload) return send(req, res, 404);
        return send(req, res, 200, JSON.stringify(payload), 'application/json; charset=utf-8');
      },
    });

    const unregisterFlag = scope.webServer.register({
      kind: 'exact',
      path: DEFAULT_FLAG_ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405);
        try {
          const buf = await readFile(DEFAULT_FLAG_PATH);
          return send(req, res, 200, buf, 'image/png');
        } catch {
          return send(req, res, 404);
        }
      },
    });

    const unregisterIdentity = scope.webServer.register({
      kind: 'exact',
      path: IDENTITY_ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405);
        try {
          const buf = await readFile(IDENTITY_PATH);
          return send(req, res, 200, buf, 'text/javascript; charset=utf-8', 'no-cache');
        } catch {
          return send(req, res, 404);
        }
      },
    });

    const unregisterIdentityTemplates = scope.webServer.register({
      kind: 'exact',
      path: IDENTITY_TEMPLATES_ROUTE,
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405);
        return send(
          req,
          res,
          200,
          JSON.stringify(BUNDLED_IDENTITY_TEMPLATES),
          'application/json; charset=utf-8',
          'no-cache',
        );
      },
    });

    const unregisterClient = scope.webServer.register({
      kind: 'prefix',
      path: CLIENT_ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405);
        let url;
        try {
          url = new URL(req.url ?? CLIENT_ROUTE, 'http://dsh.local');
        } catch {
          return send(req, res, 400);
        }
        const resolved = resolveClientAssetPath(url.pathname);
        if (!resolved) return send(req, res, 404);
        try {
          const buf = await readFile(resolved.target);
          return send(req, res, 200, buf, resolved.mime, 'no-cache');
        } catch {
          return send(req, res, 404);
        }
      },
    });

    const unregisterBackup = scope.webServer.register({
      kind: 'exact',
      path: BACKUP_ROUTE,
      handler: async (req, res) => {
        if (req.method === 'GET' || req.method === 'HEAD') {
          const backup = await backupStore.read();
          return send(req, res, 200, JSON.stringify({ ok: true, backup }), 'application/json; charset=utf-8', 'no-store');
        }
        if (req.method === 'POST') {
          try {
            const body = await readJsonBody(req, MAX_BACKUP_BYTES);
            const saved = await backupStore.write(body?.backup ?? body);
            return send(req, res, 200, JSON.stringify({ ok: true, backup: saved }), 'application/json; charset=utf-8', 'no-store');
          } catch (error) {
            const status = typeof error?.status === 'number' ? error.status : 500;
            return send(req, res, status, JSON.stringify({ ok: false, error: error?.message || 'save failed' }), 'application/json; charset=utf-8', 'no-store');
          }
        }
        if (req.method === 'DELETE') {
          await backupStore.clear();
          return send(req, res, 200, JSON.stringify({ ok: true, backup: null }), 'application/json; charset=utf-8', 'no-store');
        }
        return send(req, res, 405);
      },
    });

    return () => {
      unregisterLocale?.();
      unregisterFlag?.();
      unregisterIdentity?.();
      unregisterIdentityTemplates?.();
      unregisterClient?.();
      unregisterBackup?.();
    };
  }, 'dsh-pirate-mode: routes'));

  ctx.inject(['systemPrompt', 'settings'], (scope) => scope.effect(() => {
    let dispose = null;
    let signature = '';

    const refresh = () => {
      const localeEntry = readSettingsEntry(scope.settings, 'locale');
      const preference = typeof localeEntry?.value?.preference === 'string'
        ? localeEntry.value.preference
        : undefined;

      if (!isPersonaActive(scope.settings, preference)) {
        if (dispose) {
          dispose();
          dispose = null;
        }
        signature = '';
        return;
      }

      const modeEntry = readSettingsEntry(scope.settings, name);
      const identity = modeEntry?.value?.identity ?? unwrap(config.identity) ?? {};
      const text = buildPromptIdentitySection({
        identity,
        langId: preference,
        fallbackTemplates: { ...BUNDLED_IDENTITY_TEMPLATES, ...(unwrap(config.identity)?.templates || {}) },
      });

      if (text === signature) return;
      signature = text;
      if (dispose) {
        dispose();
        dispose = null;
      }
      if (!text) return;
      dispose = scope.systemPrompt.section({
        name: 'pirate:ship-identity',
        order: 100,
        text,
      });
    };

    const offVolatile = scope.on?.('loader/volatile-update', refresh);
    const offDoc = scope.on?.('settings/document-updated', (ns) => {
      const id = String(ns);
      if (id === 'locale' || id === 'prompt-loader' || id === name) refresh();
    });
    refresh();
    const timer = setTimeout(refresh, 0);

    return () => {
      clearTimeout(timer);
      try { offVolatile?.(); } catch {}
      try { offDoc?.(); } catch {}
      if (dispose) dispose();
      dispose = null;
      signature = '';
    };
  }, 'dsh-pirate-mode: ship identity system prompt'));
}
