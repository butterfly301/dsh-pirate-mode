import {
  ALL_FORM_IDS,
  CORE_FORM_IDS,
  buildCommitPlan,
  buildDisablePatches,
  buildRestorePatches,
  captureMasterBackup,
  computeMasterOn,
  resolveThresholdValues,
} from './adapters.js';
import { createCards } from './cards.js';
import {
  BACKUP_ROUTE,
  BRAND,
  BRAND_SLOTS,
  DEFAULT_INTERVAL_MS,
  DEFAULT_MAX_SOUND_BYTES,
  FLAG_CHANGED_EVENT,
  FLAG_ROUTE,
  LOCALE,
  MAX_FLAG_BYTES,
  ALLOWED_FLAG_MIME,
  MORALE,
  MORALE_PHRASE_FIELDS,
  PIRATE_MODE,
  PROMPT,
  ROTATE,
  SHAKE,
  SOUND,
  SOUND_CUSTOM_ROUTE,
  SOUND_PREVIEW_EVENT,
  SOUND_UPDATED_EVENT,
  buildPromptIdentityPreview,
  collectLanguageOptions,
  formatHeroHeadline,
  isPlainObject,
  normalizeSegmentEntry,
  normalizeThresholds,
  pickDefaultLang,
  probePlayableAudio,
  readActive,
  readBrandImageDataUrl,
  resolveShipName,
} from './helpers.js';

export function createPanel(React) {
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const h = React.createElement;
  const { MasterCard, BrandCard, IdentityCard, SoundCard, MoraleCard, LanguageCard } = createCards(React);

  return function Panel({ forms, savePatch, t, locale, subscribeUi, ensureLocale, localeSwitcher, getBundledTemplates }) {
    const [snapshots, setSnapshots] = useState({});
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(undefined);
    const [missingForms, setMissingForms] = useState([]);
    const [dirty, setDirty] = useState(false);
    const [selectedLang, setSelectedLang] = useState('');
    const [phraseDrafts, setPhraseDrafts] = useState({});
    const [shakeDrafts, setShakeDrafts] = useState({});
    const [moraleTextDrafts, setMoraleTextDrafts] = useState({});
    const [intervalDraft, setIntervalDraft] = useState(null);
    const [thresholdDrafts, setThresholdDrafts] = useState(null);
    const [shipNameDraft, setShipNameDraft] = useState(undefined);
    const [mateNameDraft, setMateNameDraft] = useState(undefined);
    const [flagState, setFlagState] = useState({ available: null, hasCustom: false, version: 0, busy: false, message: '' });
    const [brandErrors, setBrandErrors] = useState({});
    const [soundCustom, setSoundCustom] = useState({
      available: null,
      maxBytes: DEFAULT_MAX_SOUND_BYTES,
      busyKind: null,
      message: '',
      messageKind: '',
      slots: {},
    });
    const [, setUiVersion] = useState(0);
    const dirtyRef = useRef(false);
    const savedRef = useRef(null);
    const pendingBackupActionRef = useRef(null);
    const brandSlotCacheRef = useRef({});

    const ids = useMemo(() => Object.keys(forms), [forms]);

    const refreshFlagState = useCallback(() => {
      if (typeof fetch !== 'function') return;
      fetch(FLAG_ROUTE, { cache: 'no-store' })
        .then((res) => (res && res.ok ? res.json() : null))
        .then((payload) => {
          if (payload && payload.ok) {
            setFlagState((prev) => ({
              ...prev,
              available: true,
              hasCustom: Boolean(payload.hasCustom),
              version: payload.updatedAt || prev.version || Date.now(),
            }));
          } else {
            setFlagState((prev) => ({ ...prev, available: false }));
          }
        })
        .catch(() => setFlagState((prev) => ({ ...prev, available: false })));
    }, []);

    const refreshSoundCustom = useCallback(() => {
      if (typeof fetch !== 'function') return;
      fetch(SOUND_CUSTOM_ROUTE, { cache: 'no-store' })
        .then((res) => (res && res.ok ? res.json() : null))
        .then((payload) => {
          if (payload && payload.ok) {
            setSoundCustom((prev) => ({
              ...prev,
              available: true,
              maxBytes: typeof payload.maxBytes === 'number' && payload.maxBytes > 0 ? payload.maxBytes : prev.maxBytes,
              slots: isPlainObject(payload.slots) ? payload.slots : {},
            }));
          } else {
            setSoundCustom((prev) => ({ ...prev, available: false }));
          }
        })
        .catch(() => setSoundCustom((prev) => ({ ...prev, available: false })));
    }, []);

    const hydrateMasterBackup = useCallback(() => {
      if (typeof fetch !== 'function') return;
      fetch(BACKUP_ROUTE, { cache: 'no-store' })
        .then((res) => (res && res.ok ? res.json() : null))
        .then((payload) => {
          if (payload && payload.ok && isPlainObject(payload.backup) && !savedRef.current) {
            savedRef.current = payload.backup;
          }
        })
        .catch(() => {});
    }, []);

    useEffect(() => {
      ensureLocale(readActive(locale));
      refreshFlagState();
      refreshSoundCustom();
      hydrateMasterBackup();

      const onFlagChanged = (evt) => {
        const d = evt?.detail;
        if (d && typeof d === 'object') {
          setFlagState((prev) => ({
            ...prev,
            available: true,
            hasCustom: Boolean(d.hasCustom),
            version: d.version || Date.now(),
          }));
        } else {
          refreshFlagState();
        }
      };
      const onSoundUpdated = (evt) => {
        const slots = evt?.detail?.slots;
        if (isPlainObject(slots)) {
          setSoundCustom((prev) => ({ ...prev, available: true, slots }));
        } else {
          refreshSoundCustom();
        }
      };
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener(FLAG_CHANGED_EVENT, onFlagChanged);
        window.addEventListener(SOUND_UPDATED_EVENT, onSoundUpdated);
      }
      const unsubUi = subscribeUi(() => setUiVersion((v) => v + 1));
      return () => {
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener(FLAG_CHANGED_EVENT, onFlagChanged);
          window.removeEventListener(SOUND_UPDATED_EVENT, onSoundUpdated);
        }
        try { unsubUi?.(); } catch {}
      };
    }, [subscribeUi, ensureLocale, locale, refreshFlagState, refreshSoundCustom, hydrateMasterBackup]);

    const syncFromForms = useCallback(() => {
      const next = {};
      for (const id of ids) {
        next[id] = forms[id].getSnapshot();
      }
      setSnapshots(next);
      const missing = CORE_FORM_IDS.filter((id) => next[id]?.status === 'unavailable');
      setMissingForms(missing);
      const coreReady = CORE_FORM_IDS.every((id) => next[id]?.status === 'ready');
      setStatus(coreReady ? 'ready' : (missing.length > 0 ? 'error' : 'loading'));
    }, [ids, forms]);

    useEffect(() => {
      let disposed = false;
      const refresh = () => { if (!disposed && !dirtyRef.current) syncFromForms(); };
      const unsubs = ids.map((id) => forms[id].subscribe(refresh));
      refresh();
      return () => { disposed = true; for (const u of unsubs) { try { u(); } catch {} } };
    }, [ids, forms, syncFromForms]);

    const valueOf = (id) => {
      const snap = snapshots[id];
      return snap && snap.status === 'ready' && isPlainObject(snap.value) ? snap.value : {};
    };

    const baseOf = (id) => {
      const snap = snapshots[id];
      return snap && isPlainObject(snap.base) ? snap.base : {};
    };

    const setLocal = (id, patch) => {
      dirtyRef.current = true;
      setSnapshots((prev) => {
        const snap = prev[id];
        if (!snap || snap.status !== 'ready') return prev;
        return { ...prev, [id]: { ...snap, value: { ...snap.value, ...patch } } };
      });
      setDirty(true);
    };

    const commit = async () => {
      setStatus('saving');
      setError(undefined);
      try {
        const { opsByNs, pendingLocaleTarget } = buildCommitPlan({
          forms,
          valueOf,
          baseOf,
          savedBackup: savedRef.current,
          phraseDrafts,
          shakeDrafts,
          intervalDraft,
          thresholdDrafts,
          moraleTextDrafts,
          shipNameDraft,
          mateNameDraft,
          locale,
          t,
        });

        await savePatch(opsByNs);

        if (typeof fetch === 'function') {
          if (pendingBackupActionRef.current === 'save' && savedRef.current) {
            await fetch(BACKUP_ROUTE, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ backup: savedRef.current }),
            }).catch(() => {});
          } else if (pendingBackupActionRef.current === 'clear') {
            savedRef.current = null;
            await fetch(BACKUP_ROUTE, { method: 'DELETE' }).catch(() => {});
          }
        } else if (pendingBackupActionRef.current === 'clear') {
          savedRef.current = null;
        }
        pendingBackupActionRef.current = null;

        dirtyRef.current = false;
        setPhraseDrafts({});
        setShakeDrafts({});
        setMoraleTextDrafts({});
        setIntervalDraft(null);
        setThresholdDrafts(null);
        setShipNameDraft(undefined);
        setMateNameDraft(undefined);
        setDirty(false);
        syncFromForms();
        setStatus('saved');
        if (pendingLocaleTarget) localeSwitcher.switchWhenRegistered(pendingLocaleTarget);
      } catch (cause) {
        const msg = cause && cause.partialSaved?.length
          ? t('partialSaveError')
            .split('{failed}').join(cause.failedNamespace || '')
            .split('{saved}').join(cause.partialSaved.join(', '))
            .split('{reason}').join(cause.message || String(cause))
          : String(cause && cause.message ? cause.message : cause);
        setError(msg);
        setStatus('error');
      }
    };

    if (status === 'loading') return h('div', { className: 'pm-panel' }, h('div', { className: 'pm-note' }, t('loading')));
    if ((status === 'error' || status === 'unavailable') && !dirty) {
      return h('div', { className: 'pm-panel' },
        h('div', { className: 'pm-error' }, missingForms.length > 0 ? `${t('loadFailed')}: ${missingForms.join(', ')}` : t('loadFailed')),
        error ? h('div', { className: 'pm-note' }, error) : null);
    }

    const brandPack = valueOf(BRAND).pack;
    const brandBase = baseOf(BRAND).pack;

    const buildBrandPack = (slot, value) => {
      const next = isPlainObject(brandPack)
        ? { ...brandPack }
        : { id: (isPlainObject(brandBase) && brandBase.id) || 'pirate', sidebarMark: false, heroMark: false, wordmark: false };
      next[slot] = value;
      return next;
    };

    const toggleBrandSlot = (slot, checked) => {
      setBrandErrors((prev) => (prev[slot] ? { ...prev, [slot]: '' } : prev));
      if (checked) {
        const source = brandSlotCacheRef.current[slot]
          || (isPlainObject(savedRef.current?.[BRAND]) ? savedRef.current[BRAND][slot] : undefined)
          || (isPlainObject(brandBase) ? brandBase[slot] : undefined);
        if (!source) return;
        setLocal(BRAND, { pack: buildBrandPack(slot, source) });
        return;
      }
      if (!isPlainObject(brandPack)) return;
      if (brandPack[slot]) brandSlotCacheRef.current[slot] = brandPack[slot];
      const next = { ...brandPack, [slot]: false };
      const anyLeft = BRAND_SLOTS.some(([s]) => Boolean(next[s]));
      setLocal(BRAND, { pack: anyLeft ? next : false });
    };

    const onImportBrandSlot = async (slot, file) => {
      const result = await readBrandImageDataUrl(file);
      if (!result.ok || !result.dataUrl) {
        setBrandErrors((prev) => ({ ...prev, [slot]: t('brandInvalid') }));
        return;
      }
      setBrandErrors((prev) => (prev[slot] ? { ...prev, [slot]: '' } : prev));
      brandSlotCacheRef.current[slot] = result.dataUrl;
      setLocal(BRAND, { pack: buildBrandPack(slot, result.dataUrl) });
    };

    const onResetBrandSlot = (slot) => {
      setBrandErrors((prev) => (prev[slot] ? { ...prev, [slot]: '' } : prev));
      delete brandSlotCacheRef.current[slot];
      const fallback = isPlainObject(brandBase) ? brandBase[slot] : undefined;
      if (!fallback) {
        toggleBrandSlot(slot, false);
        return;
      }
      setLocal(BRAND, { pack: buildBrandPack(slot, fallback) });
    };

    const localePacks = valueOf(LOCALE).packs;
    const packs = Array.isArray(localePacks) ? localePacks : [];

    const rotPack = valueOf(ROTATE).pack;
    const hasRotPack = isPlainObject(rotPack);
    const phrases = hasRotPack && isPlainObject(rotPack.phrases) ? rotPack.phrases : {};
    const shakePhrasesMap = hasRotPack && isPlainObject(rotPack.shakePhrases) ? rotPack.shakePhrases : {};
    const intervalMs = hasRotPack && typeof rotPack.intervalMs === 'number' ? rotPack.intervalMs : DEFAULT_INTERVAL_MS;
    const thresholds = hasRotPack ? normalizeThresholds(rotPack.thresholds) : [30, 60];

    const promptPack = valueOf(PROMPT).pack;
    const hasPromptPack = isPlainObject(promptPack);
    const promptTexts = hasPromptPack && isPlainObject(promptPack.texts) ? promptPack.texts : {};

    const soundVal = valueOf(SOUND);
    const moraleVal = valueOf(MORALE);
    const moralePack = isPlainObject(moraleVal.pack) ? moraleVal.pack : null;
    const hasMoralePack = Boolean(moralePack);

    const langOptions = collectLanguageOptions(packs, phrases, promptTexts, shakePhrasesMap, moralePack);
    const activeLangId = langOptions.some((o) => o.id === selectedLang)
      ? selectedLang
      : pickDefaultLang(langOptions, readActive(locale));
    const activePack = packs.find((p) => p.id === activeLangId) || null;

    const onEditPhrases = (id, segKey, text) => {
      if (!hasRotPack || !id || !segKey) return;
      dirtyRef.current = true;
      setPhraseDrafts((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), [segKey]: String(text) },
      }));
      setDirty(true);
    };

    const onEditShakePhrases = (id, text) => {
      if (!hasRotPack || !id) return;
      dirtyRef.current = true;
      setShakeDrafts((prev) => ({ ...prev, [id]: String(text) }));
      setDirty(true);
    };

    const onEditMoraleText = (id, field, text) => {
      if (!hasMoralePack || !id || !field) return;
      dirtyRef.current = true;
      setMoraleTextDrafts((prev) => ({
        ...prev,
        [id]: { ...(prev[id] || {}), [field]: String(text) },
      }));
      setDirty(true);
    };

    const onEditInterval = (rawText) => {
      if (!hasRotPack) return;
      dirtyRef.current = true;
      setIntervalDraft(String(rawText));
      setDirty(true);
    };

    const onEditThreshold = (index, rawText) => {
      if (!hasRotPack) return;
      dirtyRef.current = true;
      setThresholdDrafts((prev) => {
        const base = prev ? [...prev] : [String(thresholds[0]), String(thresholds[1])];
        base[index] = String(rawText);
        return base;
      });
      setDirty(true);
    };

    const onEditPrompt = (id, text) => {
      if (!hasPromptPack || !id) return;
      setLocal(PROMPT, { pack: { ...promptPack, texts: { ...promptTexts, [id]: String(text) } } });
    };

    const onEditMessages = (pack, group, updates) => {
      const dictionaries = { ...(pack.dictionaries || {}) };
      dictionaries[group] = { ...(dictionaries[group] || {}), ...updates };
      const next = packs.map((p) => (p.id === pack.id ? { ...p, dictionaries } : p));
      setLocal(LOCALE, { packs: next });
    };

    const masterOn = computeMasterOn(valueOf);
    const toggleMaster = (on) => {
      if (!on) {
        savedRef.current = captureMasterBackup({
          valueOf,
          phraseDrafts,
          shakeDrafts,
          intervalDraft,
          thresholdDrafts: thresholdDrafts && !resolveThresholdValues(rotPack, thresholdDrafts) ? null : thresholdDrafts,
          moraleTextDrafts,
        });
        pendingBackupActionRef.current = 'save';
        setPhraseDrafts({});
        setShakeDrafts({});
        setMoraleTextDrafts({});
        setIntervalDraft(null);
        setThresholdDrafts(null);
        const patches = buildDisablePatches();
        for (const [id, patch] of Object.entries(patches)) {
          if (ALL_FORM_IDS.includes(id)) setLocal(id, patch);
        }
        return;
      }
      const patches = buildRestorePatches({ saved: savedRef.current, baseOf });
      pendingBackupActionRef.current = 'clear';
      for (const [id, patch] of Object.entries(patches)) {
        if (ALL_FORM_IDS.includes(id)) setLocal(id, patch);
      }
    };

    const activeSegs = normalizeSegmentEntry(phrases[activeLangId]);
    const activeSegDraft = (activeLangId && phraseDrafts[activeLangId]) || {};
    const phraseSegments = {
      start: Object.prototype.hasOwnProperty.call(activeSegDraft, 'start') ? activeSegDraft.start : activeSegs.start.join('\n'),
      progress: Object.prototype.hasOwnProperty.call(activeSegDraft, 'progress') ? activeSegDraft.progress : activeSegs.progress.join('\n'),
      long: Object.prototype.hasOwnProperty.call(activeSegDraft, 'long') ? activeSegDraft.long : activeSegs.long.join('\n'),
    };
    const shakeText = activeLangId && Object.prototype.hasOwnProperty.call(shakeDrafts, activeLangId)
      ? shakeDrafts[activeLangId]
      : (Array.isArray(shakePhrasesMap[activeLangId]) ? shakePhrasesMap[activeLangId].join('\n') : '');

    const activeMoraleDraft = (activeLangId && moraleTextDrafts[activeLangId]) || {};
    const moraleTexts = {
      commandDescription: Object.prototype.hasOwnProperty.call(activeMoraleDraft, 'commandDescription')
        ? activeMoraleDraft.commandDescription
        : (moralePack?.commandDescription?.[activeLangId] || ''),
    };
    for (const [field] of MORALE_PHRASE_FIELDS) {
      moraleTexts[field] = Object.prototype.hasOwnProperty.call(activeMoraleDraft, field)
        ? activeMoraleDraft[field]
        : (Array.isArray(moralePack?.[field]?.[activeLangId]) ? moralePack[field][activeLangId].join('\n') : '');
    }

    const intervalText = intervalDraft !== null ? intervalDraft : String(intervalMs);
    const thresholdTexts = thresholdDrafts || [String(thresholds[0]), String(thresholds[1])];

    const identity = isPlainObject(valueOf(PIRATE_MODE).identity) ? valueOf(PIRATE_MODE).identity : {};
    const fallbackTemplates = isPlainObject(baseOf(PIRATE_MODE).identity?.templates)
      ? baseOf(PIRATE_MODE).identity.templates
      : {};
    const mergedTemplates = {
      ...(getBundledTemplates?.() || {}),
      ...fallbackTemplates,
      ...(isPlainObject(identity.templates) ? identity.templates : {}),
    };

    const previewLangId = activeLangId || readActive(locale);
    const effectiveShipOverride = shipNameDraft !== undefined ? shipNameDraft : identity.shipNameOverride;
    const isCustomShipName = typeof effectiveShipOverride === 'string';
    const shipNameValue = isCustomShipName
      ? effectiveShipOverride
      : resolveShipName({ ...identity, shipNameOverride: false }, previewLangId, mergedTemplates);
    const mateNameValue = mateNameDraft !== undefined
      ? mateNameDraft
      : (typeof identity.mateName === 'string' ? identity.mateName : '');

    const previewIdentity = {
      ...identity,
      shipNameOverride: effectiveShipOverride,
      mateName: mateNameValue,
      templates: mergedTemplates,
    };
    const previewBaseHeadline = activePack?.dictionaries?.conversation?.['hero.headline'] || '';
    const heroPreview = previewBaseHeadline
      ? formatHeroHeadline({
        baseText: previewBaseHeadline,
        identity: previewIdentity,
        langId: previewLangId,
        isPirateLocale: true,
      })
      : '';
    const personaPreview = buildPromptIdentityPreview({
      identity: previewIdentity,
      fallbackTemplates: mergedTemplates,
      langId: previewLangId,
    });

    const onEditShipName = (val) => {
      dirtyRef.current = true;
      setShipNameDraft(String(val));
      setDirty(true);
    };
    const onRestoreShipName = () => {
      dirtyRef.current = true;
      setShipNameDraft(false);
      setDirty(true);
    };
    const onEditMateName = (val) => {
      dirtyRef.current = true;
      setMateNameDraft(String(val));
      setDirty(true);
    };

    const emitFlagChanged = (hasCustom, version = Date.now()) => {
      try {
        window.dispatchEvent(new CustomEvent(FLAG_CHANGED_EVENT, { detail: { hasCustom, version } }));
      } catch {}
    };

    const onUploadFlag = async (file) => {
      if (!file) return;
      if (file.size > MAX_FLAG_BYTES || (file.type && !ALLOWED_FLAG_MIME.has(file.type))) {
        setFlagState((prev) => ({ ...prev, message: t('flagInvalid') }));
        return;
      }
      setFlagState((prev) => ({ ...prev, busy: true, message: '' }));
      try {
        const buf = await file.arrayBuffer();
        const res = await fetch(FLAG_ROUTE, {
          method: 'POST',
          headers: { 'content-type': file.type || 'application/octet-stream' },
          body: buf,
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) {
          setFlagState((prev) => ({ ...prev, busy: false, message: t('flagInvalid') }));
          return;
        }
        const version = payload.updatedAt || Date.now();
        setFlagState({ available: true, hasCustom: true, version, busy: false, message: t('flagUpdated') });
        emitFlagChanged(true, version);
      } catch {
        setFlagState((prev) => ({ ...prev, busy: false, message: t('flagUnavailable') }));
      }
    };

    const onResetFlag = async () => {
      setFlagState((prev) => ({ ...prev, busy: true, message: '' }));
      try {
        const res = await fetch(FLAG_ROUTE, { method: 'DELETE' });
        if (!res.ok) {
          setFlagState((prev) => ({ ...prev, busy: false, message: t('flagUnavailable') }));
          return;
        }
        const version = Date.now();
        setFlagState({ available: true, hasCustom: false, version, busy: false, message: t('flagReset') });
        emitFlagChanged(false, version);
      } catch {
        setFlagState((prev) => ({ ...prev, busy: false, message: t('flagUnavailable') }));
      }
    };

    const emitSoundUpdated = (slots) => {
      try {
        window.dispatchEvent(new CustomEvent(SOUND_UPDATED_EVENT, { detail: { slots, version: Date.now() } }));
      } catch {}
    };
    const onEditSound = (patchObj) => setLocal(SOUND, patchObj);
    const onPreviewSound = (kind, overrideSlots) => {
      try {
        const volume = typeof soundVal.volume === 'number' ? soundVal.volume : 0.8;
        window.dispatchEvent(new CustomEvent(SOUND_PREVIEW_EVENT, {
          detail: { kind, volume, slots: overrideSlots || soundCustom.slots },
        }));
      } catch {}
    };
    const onUploadSound = async (kind, file) => {
      if (!kind || !file) return;
      if (file.size <= 0 || file.size > soundCustom.maxBytes) {
        setSoundCustom((prev) => ({ ...prev, messageKind: kind, message: t('soundTooLarge') }));
        return;
      }
      setSoundCustom((prev) => ({ ...prev, busyKind: kind, messageKind: kind, message: '' }));
      try {
        const checked = await probePlayableAudio(file, soundCustom.maxBytes);
        if (!checked.ok || !checked.buf) {
          const msg = checked.reason === 'size' ? t('soundTooLarge') : t('soundDecodeFailed');
          setSoundCustom((prev) => ({ ...prev, busyKind: null, messageKind: kind, message: msg }));
          return;
        }
        const url = `${SOUND_CUSTOM_ROUTE}/${encodeURIComponent(kind)}?filename=${encodeURIComponent(file.name || '')}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': file.type || 'application/octet-stream',
            'x-sound-filename': encodeURIComponent(file.name || ''),
          },
          body: checked.buf,
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) {
          const msg = res.status === 413
            ? t('soundTooLarge')
            : (res.status === 415 ? t('soundUnsupported') : t('soundUploadFailed'));
          setSoundCustom((prev) => ({ ...prev, busyKind: null, messageKind: kind, message: msg }));
          return;
        }
        const nextSlots = isPlainObject(payload.slots) ? payload.slots : { ...soundCustom.slots, [kind]: payload.slot };
        setSoundCustom((prev) => ({
          ...prev,
          available: true,
          busyKind: null,
          messageKind: kind,
          message: t('soundUploaded'),
          slots: nextSlots,
        }));
        emitSoundUpdated(nextSlots);
        onPreviewSound(kind, nextSlots);
      } catch {
        setSoundCustom((prev) => ({ ...prev, busyKind: null, messageKind: kind, message: t('soundUnavailable') }));
      }
    };
    const onResetSound = async (kind) => {
      if (!kind) return;
      setSoundCustom((prev) => ({ ...prev, busyKind: kind, messageKind: kind, message: '' }));
      try {
        const res = await fetch(`${SOUND_CUSTOM_ROUTE}/${encodeURIComponent(kind)}`, { method: 'DELETE' });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) {
          setSoundCustom((prev) => ({ ...prev, busyKind: null, messageKind: kind, message: t('soundUnavailable') }));
          return;
        }
        const nextSlots = isPlainObject(payload.slots) ? payload.slots : { ...soundCustom.slots, [kind]: payload.slot };
        setSoundCustom((prev) => ({
          ...prev,
          available: true,
          busyKind: null,
          messageKind: kind,
          message: t('soundReset'),
          slots: nextSlots,
        }));
        emitSoundUpdated(nextSlots);
      } catch {
        setSoundCustom((prev) => ({ ...prev, busyKind: null, messageKind: kind, message: t('soundUnavailable') }));
      }
    };
    const onEditMorale = (key, val) => setLocal(MORALE, { [key]: val });

    return h('div', { className: 'pm-panel' },
      h('div', { className: 'pm-head' },
        h('div', { className: 'pm-head__hint' }, t('hint'))),
      error ? h('div', { className: 'pm-error' }, error) : null,
      h(MasterCard, { masterOn, onToggle: toggleMaster, t }),
      h(BrandCard, {
        brandPack,
        brandBase,
        brandErrors,
        onToggleSlot: toggleBrandSlot,
        onImportSlot: onImportBrandSlot,
        onResetSlot: onResetBrandSlot,
        t,
      }),
      h(IdentityCard, {
        shipNameValue,
        isCustomShipName,
        onEditShipName,
        onRestoreShipName,
        mateNameValue,
        onEditMateName,
        heroPreview,
        personaPreview,
        flagState,
        onUploadFlag,
        onResetFlag,
        t,
      }),
      h(SoundCard, { soundVal, soundCustom, onEditSound, onPreviewSound, onUploadSound, onResetSound, t }),
      h(MoraleCard, { moraleVal, onEditMorale, t }),
      h(LanguageCard, {
        langOptions,
        activeLangId,
        onSelectLang: setSelectedLang,
        activePack,
        onEditMessages,
        hasRotPack,
        phraseSegments,
        onEditPhrases,
        shakeText,
        onEditShakePhrases,
        intervalText,
        onEditInterval,
        thresholdTexts,
        onEditThreshold,
        hasPromptPack,
        promptText: promptTexts[activeLangId] || '',
        onEditPrompt,
        hasMoralePack,
        moraleTexts,
        onEditMoraleText,
        t,
      }),
      h('button', { type: 'button', className: 'pm-save', disabled: status === 'saving', onClick: commit },
        status === 'saving' ? t('saving') : (status === 'saved' && !dirty ? t('saved') : t('save'))));
  };
}
