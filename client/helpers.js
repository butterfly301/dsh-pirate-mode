import {
  MAX_IDENTITY_NAME_LENGTH,
  primarySubtag,
  pickLocalized,
  validateIdentityName,
  resolveShipName,
  resolveMateName,
  buildPromptIdentityPreview,
  formatHeroHeadline,
} from '../identity.js';

export {
  MAX_IDENTITY_NAME_LENGTH,
  primarySubtag,
  pickLocalized,
  validateIdentityName,
  resolveShipName,
  resolveMateName,
  buildPromptIdentityPreview,
  formatHeroHeadline,
};

export const NS = 'pirate-mode-ui';
export const LOCALE_ROUTE = '/pirate-mode/locale/';
export const FLAG_ROUTE = '/ocean-background/flag';
export const FLAG_IMAGE_ROUTE = '/ocean-background/flag/image';
export const DEFAULT_FLAG_IMAGE_ROUTE = '/pirate-mode/default-flag.png';
export const FLAG_CHANGED_EVENT = 'dsh:ocean-flag-changed';
export const SOUND_CUSTOM_ROUTE = '/sound-pack-loader/custom';
export const SOUND_PREVIEW_EVENT = 'dsh:sound-pack-loader:preview';
export const SOUND_UPDATED_EVENT = 'dsh:sound-pack-loader:updated';
export const BACKUP_ROUTE = '/pirate-mode/master-backup';

export const PIRATE_MODE = 'pirate-mode';
export const BRAND = 'brand-pack-loader';
export const LOCALE = 'locale-pack-loader';
export const ROTATE = 'dsh-rotate-status-text';
export const PROMPT = 'prompt-loader';
export const SOUND = 'dsh-sound-pack-loader';
export const CONFETTI = 'dsh-confetti';
export const MORALE = 'dsh-crew-morale';
export const SHAKE = 'dsh-window-shake';
export const LOCALE_PREF = 'locale';

export const MAX_FLAG_BYTES = 2 * 1024 * 1024;
export const ALLOWED_FLAG_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const MAX_BRAND_DATAURL_CHARS = 2 * 1024 * 1024;
export const BRAND_ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml';
export const BRAND_SOURCE_RE = /^data:image\/(?:svg\+xml|png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/u;
export const DEFAULT_MAX_SOUND_BYTES = 2 * 1024 * 1024;
export const SOUND_ACCEPT = '.wav,.mp3,.ogg,.m4a,.flac,.webm,audio/wav,audio/mpeg,audio/ogg,audio/mp4,audio/flac,audio/webm';

export const BRAND_SLOTS = [
  ['sidebarMark', 'slotSidebar'],
  ['heroMark', 'slotHero'],
  ['wordmark', 'slotWordmark'],
];
export const AUTO_LOCALE_KEY = 'dsh-pirate-mode:auto-locale-v1';
export const DEFAULT_INTERVAL_MS = 10000;
export const DEFAULT_THRESHOLDS = [30, 60];
export const PHRASE_SEGMENTS = [
  ['start', 'phrasesStart'],
  ['progress', 'phrasesProgress'],
  ['long', 'phrasesLong'],
];
export const MORALE_PHRASE_FIELDS = [
  ['protestPhrases', 'moraleProtestPhrases'],
  ['retryPhrases', 'moraleRetryPhrases'],
  ['failedPhrases', 'moraleFailedPhrases'],
  ['cancelledPhrases', 'moraleCancelledPhrases'],
  ['rumPhrases', 'moraleRumPhrases'],
];
export const MORALE_NUMERIC_FIELDS = [
  ['initial', 'moraleInitial', 100],
  ['retryDelta', 'moraleRetryDelta', -4],
  ['failedDelta', 'moraleFailedDelta', -12],
  ['cancelledDelta', 'moraleCancelledDelta', -3],
  ['lowThreshold', 'moraleLowThreshold', 30],
  ['rumTarget', 'moraleRumTarget', 100],
];

export function isPlainObject(value) {
  return !!(value && typeof value === 'object' && !Array.isArray(value));
}

export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export function readActive(locale) {
  try {
    const snap = typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : undefined;
    return snap && (snap.active ?? snap.locale ?? snap.preference);
  } catch {
    return undefined;
  }
}

export function parsePhraseLines(text) {
  return String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function normalizeSegmentEntry(entry) {
  if (Array.isArray(entry)) {
    return { start: [], progress: entry.map((s) => String(s ?? '').trim()).filter(Boolean), long: [] };
  }
  if (isPlainObject(entry)) {
    const clean = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s ?? '').trim()).filter(Boolean) : []);
    return { start: clean(entry.start), progress: clean(entry.progress), long: clean(entry.long) };
  }
  return { start: [], progress: [], long: [] };
}

export function parsePositiveInt(raw) {
  const text = String(raw ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function normalizeThresholds(raw) {
  if (!Array.isArray(raw) || raw.length !== 2) return DEFAULT_THRESHOLDS;
  const a = parsePositiveInt(raw[0]);
  const b = parsePositiveInt(raw[1]);
  if (a === null || b === null || b <= a) return DEFAULT_THRESHOLDS;
  return [a, b];
}

export function clampInterval(raw, fallback = DEFAULT_INTERVAL_MS) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(100, Math.round(n));
}

export function restoreObject(saved, fallback) {
  if (isPlainObject(saved)) return saved;
  return isPlainObject(fallback) ? fallback : false;
}

export function restorePacks(saved, fallback) {
  if (Array.isArray(saved) && saved.length) return saved;
  return Array.isArray(fallback) ? fallback : [];
}

export function collectLanguageOptions(packs, phrases, promptTexts, shakePhrases = {}, moralePack = null) {
  const seen = new Map();
  for (const pack of packs) {
    if (pack && pack.id && !seen.has(pack.id)) seen.set(pack.id, pack.label || pack.id);
  }
  const addIds = (obj) => {
    if (!isPlainObject(obj)) return;
    for (const id of Object.keys(obj)) {
      if (id && !seen.has(id)) seen.set(id, id);
    }
  };
  addIds(phrases);
  addIds(shakePhrases);
  addIds(promptTexts);
  if (isPlainObject(moralePack)) {
    addIds(moralePack.commandDescription);
    for (const [field] of MORALE_PHRASE_FIELDS) addIds(moralePack[field]);
  }
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}

export function pickDefaultLang(options, active) {
  if (!options.length) return '';
  if (active && options.some((o) => o.id === active)) return active;
  const want = primarySubtag(active);
  if (want) {
    const hit = options.find((o) => primarySubtag(o.id) === want);
    if (hit) return hit.id;
  }
  const enHit = options.find((o) => primarySubtag(o.id) === 'en');
  if (enHit) return enHit.id;
  return options[0].id;
}

export function findPiratePackFor(packs, active) {
  if (!Array.isArray(packs) || !active) return undefined;
  if (packs.some((p) => p && p.id === active)) return undefined;
  const want = primarySubtag(active);
  return packs.find((p) => p && p.fallback === active)
    || packs.find((p) => p && primarySubtag(p.fallback) === want);
}

export async function probePlayableAudio(file, maxBytes = DEFAULT_MAX_SOUND_BYTES) {
  const buf = await file.arrayBuffer();
  if (!buf || buf.byteLength === 0 || buf.byteLength > maxBytes) {
    return { ok: false, reason: 'size', buf: null };
  }
  if (typeof Audio !== 'function' || typeof URL?.createObjectURL !== 'function') {
    return { ok: true, buf };
  }
  const blob = new Blob([buf], { type: file.type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const playable = await new Promise((resolve) => {
    let settled = false;
    const audio = new Audio();
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeEventListener('loadedmetadata', onOk);
      audio.removeEventListener('canplay', onOk);
      audio.removeEventListener('error', onErr);
      try { audio.removeAttribute('src'); audio.load(); } catch {}
      resolve(result);
    };
    const onOk = () => done(true);
    const onErr = () => done(false);
    const timer = setTimeout(() => done(false), 4000);
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', onOk);
    audio.addEventListener('canplay', onOk);
    audio.addEventListener('error', onErr);
    audio.src = url;
    try { audio.load(); } catch {}
  });
  try { URL.revokeObjectURL(url); } catch {}
  return { ok: playable, reason: playable ? '' : 'decode', buf: playable ? buf : null };
}

function detectBrandImageMime(file, bytes) {
  if (file?.type === 'image/png' || file?.type === 'image/jpeg' || file?.type === 'image/webp' || file?.type === 'image/svg+xml') {
    return file.type;
  }
  const lower = String(file?.name || '').toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'image/jpeg';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return '';
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  const parts = [];
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
  }
  return btoa(parts.join(''));
}

export async function readBrandImageDataUrl(file) {
  if (!file || file.size <= 0 || file.size > MAX_BRAND_DATAURL_CHARS) {
    return { ok: false, dataUrl: '' };
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const mime = detectBrandImageMime(file, bytes);
  if (!mime) return { ok: false, dataUrl: '' };
  const dataUrl = `data:${mime};base64,${arrayBufferToBase64(buf)}`;
  if (dataUrl.length > MAX_BRAND_DATAURL_CHARS || !BRAND_SOURCE_RE.test(dataUrl)) {
    return { ok: false, dataUrl: '' };
  }
  if (typeof Image !== 'function') return { ok: true, dataUrl };
  const decoded = await new Promise((resolve) => {
    let settled = false;
    const img = new Image();
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), 4000);
    img.onload = () => done((img.naturalWidth || 0) > 0 && (img.naturalHeight || 0) > 0);
    img.onerror = () => done(false);
    img.src = dataUrl;
  });
  return { ok: decoded, dataUrl: decoded ? dataUrl : '' };
}
