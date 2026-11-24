// Pure identity helpers shared between host system-prompt injection, client UI, and tests.

export const MAX_IDENTITY_NAME_LENGTH = 40;

export function primarySubtag(lang) {
  return String(lang ?? '').split(/[-_]/)[0].toLowerCase();
}

function mergeTemplates(primary, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const extra = primary && typeof primary === 'object' ? primary : {};
  return { ...base, ...extra };
}

export function pickLocalized(map, active) {
  if (!map || typeof map !== 'object') return undefined;
  if (active && map[active] !== undefined) return map[active];
  const want = primarySubtag(active);
  if (want) {
    for (const [id, value] of Object.entries(map)) {
      if (primarySubtag(id) === want) return value;
    }
  }
  if (map.en !== undefined) return map.en;
  for (const [id, value] of Object.entries(map)) {
    if (primarySubtag(id) === 'en') return value;
  }
  return Object.values(map)[0];
}

export function validateIdentityName(raw) {
  if (raw === null || raw === undefined || raw === false) {
    return { ok: true, value: '' };
  }
  const text = String(raw);
  if (/[\r\n]/.test(text)) {
    return { ok: false, reason: 'newlines' };
  }
  const trimmed = text.trim();
  if ([...trimmed].length > MAX_IDENTITY_NAME_LENGTH) {
    return { ok: false, reason: 'tooLong' };
  }
  return { ok: true, value: trimmed };
}

export function resolveShipName(identity, langId, fallbackTemplates) {
  const templates = mergeTemplates(identity?.templates, fallbackTemplates);
  const override = identity?.shipNameOverride;
  if (typeof override === 'string') {
    return override.trim();
  }
  const tpl = pickLocalized(templates, langId);
  return typeof tpl?.defaultShipName === 'string' ? tpl.defaultShipName.trim() : '';
}

export function resolveMateName(identity) {
  return typeof identity?.mateName === 'string' ? identity.mateName.trim() : '';
}

export function buildPromptIdentitySection({ identity, langId, fallbackTemplates }) {
  const templates = mergeTemplates(identity?.templates, fallbackTemplates);
  const tpl = pickLocalized(templates, langId);
  if (!tpl || typeof tpl !== 'object') return '';

  const shipName = resolveShipName(identity, langId, templates);
  const mateName = resolveMateName(identity);
  const lines = [];

  if (shipName && typeof tpl.promptShipTemplate === 'string' && tpl.promptShipTemplate.trim()) {
    lines.push(tpl.promptShipTemplate.split('{shipName}').join(shipName));
  }
  if (mateName && typeof tpl.promptMateTemplate === 'string' && tpl.promptMateTemplate.trim()) {
    lines.push(tpl.promptMateTemplate.split('{mateName}').join(mateName));
  }
  return lines.join('\n');
}

export const buildPromptIdentityPreview = buildPromptIdentitySection;

export function formatHeroHeadline({ baseText, identity, fallbackTemplates, langId, isPirateLocale }) {
  if (!isPirateLocale || !baseText) return baseText;
  const templates = mergeTemplates(identity?.templates, fallbackTemplates);
  const tpl = pickLocalized(templates, langId);
  const shipName = resolveShipName(identity, langId, templates);
  if (!shipName) return baseText;
  const subtag = primarySubtag(langId);
  const defaultPrefix = subtag === 'zh' || subtag === 'ja' ? '{shipName}，{headline}' : '{shipName}, {headline}';
  const prefixTpl = tpl && typeof tpl.heroPrefixTemplate === 'string' && tpl.heroPrefixTemplate.trim()
    ? tpl.heroPrefixTemplate
    : defaultPrefix;
  return prefixTpl
    .split('{shipName}')
    .join(shipName)
    .split('{headline}')
    .join(baseText);
}
