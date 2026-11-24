import {
  BRAND,
  BRAND_SLOTS,
  CONFETTI,
  DEFAULT_INTERVAL_MS,
  LOCALE,
  LOCALE_PREF,
  MORALE,
  MORALE_NUMERIC_FIELDS,
  MORALE_PHRASE_FIELDS,
  PIRATE_MODE,
  PROMPT,
  ROTATE,
  SHAKE,
  SOUND,
  clampInterval,
  deepEqual,
  findPiratePackFor,
  isPlainObject,
  normalizeSegmentEntry,
  normalizeThresholds,
  parsePhraseLines,
  parsePositiveInt,
  readActive,
  restoreObject,
  restorePacks,
  validateIdentityName,
} from './helpers.js';

export const CORE_FORM_IDS = [BRAND, LOCALE, ROTATE, PROMPT];
export const ALL_FORM_IDS = [PIRATE_MODE, BRAND, LOCALE, ROTATE, PROMPT, SOUND, CONFETTI, MORALE, SHAKE];

export function resolveThresholdValues(currentRot, thresholdDrafts) {
  const base = normalizeThresholds(currentRot?.thresholds);
  if (!thresholdDrafts) return base;
  const a = parsePositiveInt(thresholdDrafts[0]);
  const b = parsePositiveInt(thresholdDrafts[1]);
  if (a === null || b === null || b <= a) return null;
  return [a, b];
}

export function buildNormalizedRotatePack({
  currentRot,
  phraseDrafts = {},
  shakeDrafts = {},
  intervalDraft = null,
  thresholdDrafts = null,
  invalidThresholdsMessage = 'invalidThresholds',
}) {
  if (!isPlainObject(currentRot)) return currentRot;
  const basePhrases = {};
  if (isPlainObject(currentRot.phrases)) {
    for (const [id, entry] of Object.entries(currentRot.phrases)) {
      basePhrases[id] = normalizeSegmentEntry(entry);
    }
  }
  for (const [id, segDraft] of Object.entries(phraseDrafts)) {
    const prev = normalizeSegmentEntry(basePhrases[id]);
    basePhrases[id] = {
      start: Object.prototype.hasOwnProperty.call(segDraft, 'start') ? parsePhraseLines(segDraft.start) : prev.start,
      progress: Object.prototype.hasOwnProperty.call(segDraft, 'progress') ? parsePhraseLines(segDraft.progress) : prev.progress,
      long: Object.prototype.hasOwnProperty.call(segDraft, 'long') ? parsePhraseLines(segDraft.long) : prev.long,
    };
  }
  const baseShake = {};
  if (isPlainObject(currentRot.shakePhrases)) {
    for (const [id, list] of Object.entries(currentRot.shakePhrases)) {
      const cleaned = Array.isArray(list) ? list.map((s) => String(s ?? '').trim()).filter(Boolean) : [];
      if (cleaned.length) baseShake[id] = cleaned;
    }
  }
  for (const [id, rawText] of Object.entries(shakeDrafts)) {
    const cleaned = parsePhraseLines(rawText);
    if (cleaned.length) baseShake[id] = cleaned;
    else delete baseShake[id];
  }
  const rawInterval = intervalDraft !== null ? intervalDraft : currentRot.intervalMs;
  const thresholds = resolveThresholdValues(currentRot, thresholdDrafts);
  if (!thresholds) throw new Error(invalidThresholdsMessage);
  return {
    ...currentRot,
    phrases: basePhrases,
    shakePhrases: baseShake,
    intervalMs: clampInterval(rawInterval, DEFAULT_INTERVAL_MS),
    thresholds,
  };
}

export function buildNormalizedMoralePack({ currentPack, moraleTextDrafts = {} }) {
  if (!isPlainObject(currentPack)) return currentPack;
  const next = {
    ...currentPack,
    commandDescription: isPlainObject(currentPack.commandDescription) ? { ...currentPack.commandDescription } : {},
  };
  for (const [field] of MORALE_PHRASE_FIELDS) {
    next[field] = isPlainObject(currentPack[field]) ? { ...currentPack[field] } : {};
  }
  for (const [langId, draft] of Object.entries(moraleTextDrafts)) {
    if (!isPlainObject(draft)) continue;
    if (Object.prototype.hasOwnProperty.call(draft, 'commandDescription')) {
      const desc = String(draft.commandDescription ?? '').trim();
      if (desc) next.commandDescription[langId] = desc;
      else delete next.commandDescription[langId];
    }
    for (const [field] of MORALE_PHRASE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(draft, field)) {
        const list = parsePhraseLines(draft[field]);
        if (list.length) next[field][langId] = list;
        else delete next[field][langId];
      }
    }
  }
  return next;
}

export function buildNormalizedIdentity({
  currentIdentity,
  baseTemplates,
  shipNameDraft,
  mateNameDraft,
  invalidIdentityMessage = 'invalidIdentityName',
}) {
  const src = isPlainObject(currentIdentity) ? currentIdentity : {};
  const next = {
    ...src,
    templates: isPlainObject(src.templates)
      ? src.templates
      : (isPlainObject(baseTemplates) ? baseTemplates : {}),
  };
  if (shipNameDraft !== undefined) {
    if (shipNameDraft === false) {
      next.shipNameOverride = false;
    } else {
      const checked = validateIdentityName(shipNameDraft);
      if (!checked.ok) throw new Error(invalidIdentityMessage);
      next.shipNameOverride = checked.value;
    }
  }
  if (mateNameDraft !== undefined) {
    const checked = validateIdentityName(mateNameDraft);
    if (!checked.ok) throw new Error(invalidIdentityMessage);
    next.mateName = checked.value;
  } else if (typeof next.mateName === 'string') {
    const checked = validateIdentityName(next.mateName);
    if (!checked.ok) throw new Error(invalidIdentityMessage);
    next.mateName = checked.value;
  }
  return next;
}

export function computeMasterOn(valueOf) {
  const brandPack = valueOf(BRAND).pack;
  const brandOn = BRAND_SLOTS.some(([slot]) => isPlainObject(brandPack) && Boolean(brandPack[slot]));
  const packs = Array.isArray(valueOf(LOCALE).packs) ? valueOf(LOCALE).packs : [];
  const rotPack = valueOf(ROTATE).pack;
  const rotOn = isPlainObject(rotPack) && isPlainObject(rotPack.phrases) && Object.keys(rotPack.phrases).length > 0;
  const promptPack = valueOf(PROMPT).pack;
  const promptOn = isPlainObject(promptPack)
    && isPlainObject(promptPack.texts)
    && Object.values(promptPack.texts).some((v) => typeof v === 'string' && v.trim());
  const soundOn = isPlainObject(valueOf(SOUND).pack);
  const confettiOn = isPlainObject(valueOf(CONFETTI).pack);
  const moraleOn = isPlainObject(valueOf(MORALE).pack);
  return brandOn || packs.length > 0 || rotOn || promptOn || soundOn || confettiOn || moraleOn;
}

export function captureMasterBackup({
  valueOf,
  phraseDrafts,
  shakeDrafts,
  intervalDraft,
  thresholdDrafts,
  moraleTextDrafts,
}) {
  const rawRot = valueOf(ROTATE).pack;
  let rotBackup = rawRot;
  try {
    rotBackup = buildNormalizedRotatePack({
      currentRot: rawRot,
      phraseDrafts,
      shakeDrafts,
      intervalDraft,
      thresholdDrafts,
    });
  } catch {
    rotBackup = rawRot;
  }
  const rawMoralePack = valueOf(MORALE).pack;
  const moraleBackup = isPlainObject(rawMoralePack)
    ? buildNormalizedMoralePack({ currentPack: rawMoralePack, moraleTextDrafts })
    : rawMoralePack;

  return {
    [BRAND]: valueOf(BRAND).pack,
    [LOCALE]: { packs: valueOf(LOCALE).packs, pack: valueOf(LOCALE).pack },
    [ROTATE]: rotBackup,
    [PROMPT]: valueOf(PROMPT).pack,
    [SOUND]: valueOf(SOUND).pack,
    [CONFETTI]: valueOf(CONFETTI).pack,
    [MORALE]: moraleBackup,
    [SHAKE]: { enabled: valueOf(SHAKE).enabled !== false },
  };
}

export function buildDisablePatches() {
  return {
    [BRAND]: { pack: false },
    [LOCALE]: { packs: [], pack: false },
    [ROTATE]: { pack: false },
    [PROMPT]: { pack: false },
    [SOUND]: { pack: false },
    [CONFETTI]: { pack: false },
    [MORALE]: { pack: false },
    [SHAKE]: { enabled: false },
  };
}

export function buildRestorePatches({ saved, baseOf }) {
  const s = isPlainObject(saved) ? saved : {};
  const baseLocale = baseOf(LOCALE);
  const baseShake = baseOf(SHAKE);
  return {
    [BRAND]: { pack: restoreObject(s[BRAND], baseOf(BRAND).pack) },
    [LOCALE]: {
      packs: restorePacks(s[LOCALE]?.packs, baseLocale.packs),
      pack: s[LOCALE]?.pack !== undefined ? s[LOCALE].pack : (baseLocale.pack ?? false),
    },
    [ROTATE]: { pack: restoreObject(s[ROTATE], baseOf(ROTATE).pack) },
    [PROMPT]: { pack: restoreObject(s[PROMPT], baseOf(PROMPT).pack) },
    [SOUND]: { pack: restoreObject(s[SOUND], baseOf(SOUND).pack) },
    [CONFETTI]: { pack: restoreObject(s[CONFETTI], baseOf(CONFETTI).pack) },
    [MORALE]: { pack: restoreObject(s[MORALE], baseOf(MORALE).pack) },
    [SHAKE]: { enabled: isPlainObject(s[SHAKE]) ? Boolean(s[SHAKE].enabled) : (baseShake.enabled !== false) },
  };
}

export function buildCommitPlan({
  forms,
  valueOf,
  baseOf,
  savedBackup,
  phraseDrafts,
  shakeDrafts,
  intervalDraft,
  thresholdDrafts,
  moraleTextDrafts,
  shipNameDraft,
  mateNameDraft,
  locale,
  t,
}) {
  const isReady = (id) => forms[id]?.getSnapshot?.()?.status === 'ready';
  const savedVal = (id) => {
    const snap = forms[id]?.getSnapshot?.();
    return snap && snap.status === 'ready' && isPlainObject(snap.value) ? snap.value : {};
  };

  const prevPacks = forms[LOCALE]?.getSnapshot?.()?.value?.packs;
  const wasDisabled = Array.isArray(prevPacks) && prevPacks.length === 0;
  const currentPacks = Array.isArray(valueOf(LOCALE).packs) ? valueOf(LOCALE).packs : [];

  const opsByNs = {};
  const pushOp = (ns, path, value) => {
    if (value === undefined) return;
    if (!opsByNs[ns]) opsByNs[ns] = [];
    opsByNs[ns].push({ op: 'set', path, value });
  };

  if (isReady(PIRATE_MODE)) {
    const prevId = isPlainObject(savedVal(PIRATE_MODE).identity) ? savedVal(PIRATE_MODE).identity : {};
    const nextId = buildNormalizedIdentity({
      currentIdentity: isPlainObject(valueOf(PIRATE_MODE).identity)
        ? valueOf(PIRATE_MODE).identity
        : baseOf(PIRATE_MODE).identity,
      baseTemplates: baseOf(PIRATE_MODE).identity?.templates,
      shipNameDraft,
      mateNameDraft,
      invalidIdentityMessage: t('invalidIdentityName'),
    });
    if (!deepEqual(nextId.shipNameOverride, prevId.shipNameOverride)) {
      pushOp(PIRATE_MODE, ['identity', 'shipNameOverride'], nextId.shipNameOverride);
    }
    if (!deepEqual(nextId.mateName, prevId.mateName)) {
      pushOp(PIRATE_MODE, ['identity', 'mateName'], nextId.mateName);
    }
  }

  if (isReady(BRAND)) {
    const prevBrand = savedVal(BRAND).pack;
    const nextBrand = valueOf(BRAND).pack;
    if (!deepEqual(nextBrand, prevBrand)) {
      if (isPlainObject(prevBrand) && isPlainObject(nextBrand)) {
        for (const key of Object.keys({ ...prevBrand, ...nextBrand })) {
          if (!deepEqual(nextBrand[key], prevBrand[key])) {
            pushOp(BRAND, ['pack', key], nextBrand[key]);
          }
        }
      } else {
        pushOp(BRAND, ['pack'], nextBrand);
      }
    }
  }

  if (isReady(LOCALE)) {
    const prevLocale = savedVal(LOCALE);
    const nextLocalePack = valueOf(LOCALE).pack;
    if (!deepEqual(currentPacks, prevLocale.packs)) pushOp(LOCALE, ['packs'], currentPacks);
    if (!deepEqual(nextLocalePack, prevLocale.pack)) pushOp(LOCALE, ['pack'], nextLocalePack);
  }

  if (isReady(ROTATE)) {
    const prevRot = savedVal(ROTATE).pack;
    const nextRotVal = valueOf(ROTATE).pack;
    if (!isPlainObject(prevRot) || !isPlainObject(nextRotVal)) {
      const normalized = isPlainObject(nextRotVal)
        ? buildNormalizedRotatePack({
          currentRot: nextRotVal,
          phraseDrafts,
          shakeDrafts,
          intervalDraft,
          thresholdDrafts,
          invalidThresholdsMessage: t('invalidThresholds'),
        })
        : nextRotVal;
      if (!deepEqual(normalized, prevRot)) pushOp(ROTATE, ['pack'], normalized);
    } else {
      const normalized = buildNormalizedRotatePack({
        currentRot: nextRotVal,
        phraseDrafts,
        shakeDrafts,
        intervalDraft,
        thresholdDrafts,
        invalidThresholdsMessage: t('invalidThresholds'),
      });
      const prevPhrases = isPlainObject(prevRot.phrases) ? prevRot.phrases : {};
      for (const langId of Object.keys({ ...prevPhrases, ...normalized.phrases })) {
        const rawPrev = prevPhrases[langId];
        const normPrev = normalizeSegmentEntry(rawPrev);
        const nextLang = normalized.phrases[langId] || { start: [], progress: [], long: [] };
        if (!isPlainObject(rawPrev)) {
          if (!deepEqual(nextLang, rawPrev)) pushOp(ROTATE, ['pack', 'phrases', langId], nextLang);
        } else {
          for (const segKey of ['start', 'progress', 'long']) {
            if (!deepEqual(nextLang[segKey], normPrev[segKey])) {
              pushOp(ROTATE, ['pack', 'phrases', langId, segKey], nextLang[segKey]);
            }
          }
        }
      }
      const prevShake = isPlainObject(prevRot.shakePhrases) ? prevRot.shakePhrases : {};
      for (const langId of Object.keys({ ...prevShake, ...normalized.shakePhrases })) {
        if (!deepEqual(normalized.shakePhrases[langId], prevShake[langId])) {
          pushOp(ROTATE, ['pack', 'shakePhrases', langId], normalized.shakePhrases[langId] || []);
        }
      }
      if (normalized.intervalMs !== prevRot.intervalMs) {
        pushOp(ROTATE, ['pack', 'intervalMs'], normalized.intervalMs);
      }
      if (!deepEqual(normalized.thresholds, normalizeThresholds(prevRot.thresholds))) {
        pushOp(ROTATE, ['pack', 'thresholds'], normalized.thresholds);
      }
    }
  }

  if (isReady(PROMPT)) {
    const prevPrompt = savedVal(PROMPT).pack;
    const nextPrompt = valueOf(PROMPT).pack;
    if (!isPlainObject(prevPrompt) || !isPlainObject(nextPrompt)) {
      if (!deepEqual(nextPrompt, prevPrompt)) pushOp(PROMPT, ['pack'], nextPrompt);
    } else {
      const prevTexts = isPlainObject(prevPrompt.texts) ? prevPrompt.texts : {};
      const nextTexts = isPlainObject(nextPrompt.texts) ? nextPrompt.texts : {};
      for (const langId of Object.keys({ ...prevTexts, ...nextTexts })) {
        if (nextTexts[langId] !== prevTexts[langId]) {
          pushOp(PROMPT, ['pack', 'texts', langId], nextTexts[langId]);
        }
      }
    }
  }

  if (isReady(CONFETTI)) {
    const prevConfetti = savedVal(CONFETTI).pack;
    const nextConfetti = valueOf(CONFETTI).pack;
    if (!deepEqual(nextConfetti, prevConfetti)) pushOp(CONFETTI, ['pack'], nextConfetti);
  }

  if (isReady(SOUND)) {
    const prevSound = savedVal(SOUND);
    const nextSound = valueOf(SOUND);
    const nextMuted = Boolean(nextSound.muted);
    if (nextMuted !== Boolean(prevSound.muted)) pushOp(SOUND, ['muted'], nextMuted);
    const nextVol = typeof nextSound.volume === 'number' ? nextSound.volume : 0.8;
    const prevVol = typeof prevSound.volume === 'number' ? prevSound.volume : 0.8;
    if (nextVol !== prevVol) pushOp(SOUND, ['volume'], nextVol);
    const nextTrig = nextSound.triggerMode === 'always' ? 'always' : 'background';
    const prevTrig = prevSound.triggerMode === 'always' ? 'always' : 'background';
    if (nextTrig !== prevTrig) pushOp(SOUND, ['triggerMode'], nextTrig);
    const prevEvents = isPlainObject(prevSound.events) ? prevSound.events : { completed: true, failed: true, waiting: false };
    const nextEvents = isPlainObject(nextSound.events) ? nextSound.events : prevEvents;
    for (const key of ['completed', 'failed', 'waiting']) {
      if (Boolean(nextEvents[key]) !== Boolean(prevEvents[key])) {
        pushOp(SOUND, ['events', key], Boolean(nextEvents[key]));
      }
    }
    if (!deepEqual(nextSound.pack, prevSound.pack)) pushOp(SOUND, ['pack'], nextSound.pack);
  }

  if (isReady(MORALE)) {
    const prevMorale = savedVal(MORALE);
    const nextMorale = valueOf(MORALE);
    for (const [key, , defVal] of MORALE_NUMERIC_FIELDS) {
      const nv = nextMorale[key] ?? defVal;
      const pv = prevMorale[key] ?? defVal;
      if (nv !== pv) pushOp(MORALE, [key], nv);
    }
    const prevPack = prevMorale.pack;
    const nextPack = isPlainObject(nextMorale.pack)
      ? buildNormalizedMoralePack({ currentPack: nextMorale.pack, moraleTextDrafts })
      : nextMorale.pack;
    if (!isPlainObject(prevPack) || !isPlainObject(nextPack)) {
      if (!deepEqual(nextPack, prevPack)) pushOp(MORALE, ['pack'], nextPack);
    } else {
      const prevDesc = isPlainObject(prevPack.commandDescription) ? prevPack.commandDescription : {};
      const nextDesc = isPlainObject(nextPack.commandDescription) ? nextPack.commandDescription : {};
      for (const langId of Object.keys({ ...prevDesc, ...nextDesc })) {
        if ((nextDesc[langId] || '') !== (prevDesc[langId] || '')) {
          pushOp(MORALE, ['pack', 'commandDescription', langId], nextDesc[langId] || '');
        }
      }
      for (const [field] of MORALE_PHRASE_FIELDS) {
        const pMap = isPlainObject(prevPack[field]) ? prevPack[field] : {};
        const nMap = isPlainObject(nextPack[field]) ? nextPack[field] : {};
        for (const langId of Object.keys({ ...pMap, ...nMap })) {
          if (!deepEqual(nMap[langId] || [], pMap[langId] || [])) {
            pushOp(MORALE, ['pack', field, langId], nMap[langId] || []);
          }
        }
      }
    }
  }

  if (isReady(SHAKE)) {
    const prevEnabled = savedVal(SHAKE).enabled !== false;
    const nextEnabled = valueOf(SHAKE).enabled !== false;
    if (nextEnabled !== prevEnabled) pushOp(SHAKE, ['enabled'], nextEnabled);
  }

  const active = readActive(locale);
  let pendingLocaleTarget = null;
  if (currentPacks.length === 0) {
    const knownPacks = [
      ...(Array.isArray(savedBackup?.[LOCALE]?.packs) ? savedBackup[LOCALE].packs : []),
      ...(Array.isArray(baseOf(LOCALE).packs) ? baseOf(LOCALE).packs : []),
    ];
    const activePack = knownPacks.find((p) => p && p.id === active);
    if (activePack) pushOp(LOCALE_PREF, ['preference'], activePack.fallback || 'en');
  } else if (wasDisabled) {
    const match = findPiratePackFor(currentPacks, active);
    if (match) pendingLocaleTarget = match.id;
  }

  return { opsByNs, pendingLocaleTarget };
}
