// Settings page for dsh-pirate-mode. Registers one `settings.section` and edits
// the volatile config fields of the installed loader rows via host settings.
// UI strings are fetched on demand per active language from
// /pirate-mode/locale/<lang>.json so no translation tables are embedded here.

window.__ModuleLoader__.load({
  id: 'dsh-pirate-mode',
  factory(require) {
    const React = require('react')
    const { useState, useEffect, useMemo, useRef, useCallback } = React
    const h = React.createElement

    const NS = 'pirate-mode-ui'
    const LOCALE_ROUTE = '/pirate-mode/locale/'

    const BRAND = 'brand-pack-loader'
    const LOCALE = 'locale-pack-loader'
    const ROTATE = 'dsh-rotate-status-text'
    const PROMPT = 'prompt-loader'
    const LOCALE_PREF = 'locale'

    const BRAND_SLOTS = [
      ['sidebarMark', 'slotSidebar'],
      ['heroMark', 'slotHero'],
      ['wordmark', 'slotWordmark'],
    ]
    const AUTO_LOCALE_KEY = 'dsh-pirate-mode:auto-locale-v1'
    const DEFAULT_INTERVAL_MS = 10000

    const CSS = `
.pm-panel {
  --pm-accent: var(--dsw-alias-brand-primary);
  --pm-accent-deep: var(--dsw-alias-button-primary-hover);
  --pm-accent-wash: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  --pm-danger: var(--dsw-alias-state-error-primary);
  --pm-text: var(--dsw-alias-label-primary);
  --pm-sub: var(--dsw-alias-label-secondary);
  --pm-dim: var(--dsw-alias-label-tertiary);
  --pm-bg: var(--dsw-alias-bg-layer-1);
  --pm-border: var(--dsw-alias-border-l2);
  --pm-radius: var(--dsw-radius-md);
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--pm-text);
  font-size: 14px;
  line-height: 22px;
}
.pm-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.pm-head__hint { color: var(--pm-sub); font-size: 13px; line-height: 20px; flex: 1 1 320px; }
.pm-card {
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
  background: var(--pm-bg);
  border: .5px solid var(--pm-border);
  border-radius: var(--pm-radius);
}
.pm-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.pm-card__title { font-weight: 600; margin-bottom: 2px; }
.pm-card__hint { color: var(--pm-sub); font-size: 13px; line-height: 20px; margin-bottom: 10px; }
.pm-card__head .pm-card__hint { margin-bottom: 0; }
.pm-picker { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
.pm-picker__label { color: var(--pm-sub); font-size: 12px; white-space: nowrap; }
.pm-panel select {
  font: inherit;
  font-size: 13px;
  color: var(--pm-text);
  background: var(--pm-bg);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius);
  padding: 5px 10px;
  cursor: pointer;
  max-width: 240px;
}
.pm-panel select:focus-visible { outline: 2px solid var(--pm-accent); outline-offset: 2px; }
.pm-subsection {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 0;
  border-top: .5px solid var(--pm-border);
}
.pm-subsection__title { font-weight: 600; font-size: 13px; }
.pm-subsection__hint { color: var(--pm-sub); font-size: 12px; line-height: 18px; }
.pm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-top: .5px solid var(--pm-border);
  flex-wrap: wrap;
}
.pm-row:first-of-type { border-top: none; }
.pm-label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pm-label__sub { color: var(--pm-dim); font-size: 12px; }
.pm-switch { position: relative; display: inline-flex; align-items: center; min-height: 30px; cursor: pointer; }
.pm-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.pm-switch__track {
  position: relative;
  width: 34px;
  height: 19px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--dsw-alias-bg-module-platform);
  border: 1px solid var(--pm-border);
  transition: background .15s;
}
.pm-switch__thumb {
  position: absolute;
  top: 50%;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--pm-dim);
  transform: translateY(-50%);
  transition: left .15s, background .15s;
}
.pm-switch input:checked + .pm-switch__track { background: var(--pm-accent); border-color: var(--pm-accent); }
.pm-switch input:checked + .pm-switch__track .pm-switch__thumb { left: 17px; background: var(--pm-bg); }
.pm-switch input:focus-visible + .pm-switch__track,
.pm-seg button:focus-visible,
.pm-save:focus-visible { outline: 2px solid var(--pm-accent); outline-offset: 2px; }
.pm-seg { display: inline-flex; border: 1px solid var(--pm-border); border-radius: var(--pm-radius); overflow: hidden; }
.pm-seg button { padding: 4px 12px; border: none; background: transparent; color: var(--pm-sub); font: inherit; cursor: pointer; }
.pm-seg button + button { border-left: .5px solid var(--pm-border); }
.pm-seg button[data-on="true"] { background: var(--pm-accent-wash); color: var(--pm-accent-deep); font-weight: 600; }
.pm-panel input[type=text],
.pm-panel input[type=number],
.pm-panel textarea {
  font: inherit;
  color: var(--pm-text);
  background: var(--pm-bg);
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius);
  padding: 6px 8px;
  box-sizing: border-box;
  width: 100%;
}
.pm-field { display: flex; flex-direction: column; gap: 4px; padding: 8px 0; border-top: .5px solid var(--pm-border); }
.pm-subsection .pm-field { border-top: none; padding: 4px 0; }
.pm-field__label { color: var(--pm-sub); font-size: 13px; }
.pm-panel textarea { resize: vertical; min-height: 56px; line-height: 20px; }
.pm-panel textarea.pm-prompt-area { min-height: 110px; }
.pm-save {
  align-self: flex-start;
  margin-top: 4px;
  padding: 7px 18px;
  border: none;
  border-radius: var(--pm-radius);
  background: var(--pm-accent);
  color: var(--dsw-alias-button-primary-text, #fff);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.pm-save:disabled { opacity: .6; cursor: not-allowed; }
.pm-note { color: var(--pm-dim); font-size: 12px; line-height: 18px; }
.pm-error { color: var(--pm-danger); font-size: 13px; }
@media (max-width: 640px) { .pm-row { align-items: flex-start; flex-direction: column; } }
`

    function isPlainObject(value) {
      return !!(value && typeof value === 'object' && !Array.isArray(value))
    }

    function readActive(locale) {
      try {
        const snap = typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : undefined
        return snap && (snap.active ?? snap.locale ?? snap.preference)
      } catch { return undefined }
    }

    function primarySubtag(lang) {
      return String(lang ?? '').split(/[-_]/)[0].toLowerCase()
    }

    function parsePhraseLines(text) {
      return String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    }

    function clampInterval(raw, fallback = DEFAULT_INTERVAL_MS) {
      const n = Number(raw)
      if (!Number.isFinite(n) || n <= 0) return fallback
      return Math.max(100, Math.round(n))
    }

    function restoreObject(saved, fallback) {
      if (isPlainObject(saved)) return saved
      return isPlainObject(fallback) ? fallback : false
    }

    function restorePacks(saved, fallback) {
      if (Array.isArray(saved) && saved.length) return saved
      return Array.isArray(fallback) ? fallback : []
    }

    function collectLanguageOptions(packs, phrases, promptTexts) {
      const seen = new Map()
      for (const pack of packs) {
        if (pack && pack.id && !seen.has(pack.id)) seen.set(pack.id, pack.label || pack.id)
      }
      for (const id of Object.keys(phrases)) {
        if (id && !seen.has(id)) seen.set(id, id)
      }
      for (const id of Object.keys(promptTexts)) {
        if (id && !seen.has(id)) seen.set(id, id)
      }
      return [...seen.entries()].map(([id, label]) => ({ id, label }))
    }

    function pickDefaultLang(options, active) {
      if (!options.length) return ''
      if (active && options.some(o => o.id === active)) return active
      const want = primarySubtag(active)
      if (want) {
        const hit = options.find(o => primarySubtag(o.id) === want)
        if (hit) return hit.id
      }
      return options[0].id
    }

    // Match the pirate locale pack corresponding to a base language id without
    // hardcoding any language list: each pack declares its own `fallback`.
    function findPiratePackFor(packs, active) {
      if (!Array.isArray(packs) || !active) return undefined
      if (packs.some(p => p && p.id === active)) return undefined
      const want = primarySubtag(active)
      return packs.find(p => p && p.fallback === active)
        || packs.find(p => p && primarySubtag(p.fallback) === want)
    }

    function registerNavIcon(label) {
      if (!label) return
      const entry = { [label]: 'anchor' }
      if (window.__navicIcons !== undefined) window.__navicIcons.register(entry)
      else if (Array.isArray(window.__navicIconQueue)) window.__navicIconQueue.push(entry)
      else window.__navicIconQueue = [entry]
    }

    function readAutoLocaleDone() {
      try { return window.localStorage?.getItem(AUTO_LOCALE_KEY) === '1' } catch { return false }
    }

    function markAutoLocaleDone() {
      try { window.localStorage?.setItem(AUTO_LOCALE_KEY, '1') } catch {}
    }

    // Switch locale once the target id is registered in ctx.locale's catalog,
    // avoiding a race right after dsh-locale-pack-loader registers new packs.
    function createLocaleSwitcher(locale) {
      let cancelPending = null
      const cancel = () => {
        if (!cancelPending) return
        const fn = cancelPending
        cancelPending = null
        try { fn() } catch {}
      }
      const switchWhenRegistered = (targetId, onDone) => {
        cancel()
        if (!targetId || typeof locale.setLocale !== 'function') return
        const attempt = () => {
          try {
            locale.setLocale(targetId)
            cancel()
            onDone?.()
            return true
          } catch {
            return false
          }
        }
        if (attempt()) return
        if (typeof locale.subscribe !== 'function') return
        const unsub = locale.subscribe(() => { attempt() })
        cancelPending = unsub
      }
      return { switchWhenRegistered, cancel }
    }

    function Switch({ checked, onChange, label }) {
      return h('label', { className: 'pm-switch' },
        h('input', { type: 'checkbox', checked, onChange: e => onChange(e.target.checked), 'aria-label': label }),
        h('span', { className: 'pm-switch__track' }, h('span', { className: 'pm-switch__thumb' })))
    }

    function Segmented({ value, onChange, a, b }) {
      return h('div', { className: 'pm-seg' },
        h('button', { type: 'button', 'data-on': String(value === 'pirate'), onClick: () => onChange('pirate') }, a),
        h('button', { type: 'button', 'data-on': String(value === 'original'), onClick: () => onChange('original') }, b))
    }

    function MasterCard({ masterOn, onToggle, t }) {
      return h('div', { className: 'pm-card' },
        h('div', { className: 'pm-card__title' }, t('master')),
        h('div', { className: 'pm-card__hint' }, t('masterHint')),
        h('div', { className: 'pm-row' },
          h('div', { className: 'pm-label' },
            h('span', null, t('master')),
            h('span', { className: 'pm-label__sub' }, t('on') + ' / ' + t('off'))),
          h(Switch, { checked: masterOn, onChange: onToggle, label: t('master') })))
    }

    function BrandCard({ brandSlotOn, onSlotChange, t }) {
      return h('div', { className: 'pm-card' },
        h('div', { className: 'pm-card__title' }, t('brand')),
        h('div', { className: 'pm-card__hint' }, t('brandHint')),
        BRAND_SLOTS.map(([slot, labelKey]) => h('div', { className: 'pm-row', key: slot },
          h('div', { className: 'pm-label' }, h('span', null, t(labelKey))),
          h(Segmented, {
            value: brandSlotOn(slot) ? 'pirate' : 'original',
            a: t('pirate'),
            b: t('original'),
            onChange: mode => onSlotChange(slot, mode),
          }))))
    }

    function LanguageCard({
      langOptions, activeLangId, onSelectLang, activePack, onEditMessages,
      hasRotPack, phraseText, onEditPhrases, intervalText, onEditInterval,
      hasPromptPack, promptText, onEditPrompt, t,
    }) {
      return h('div', { className: 'pm-card' },
        h('div', { className: 'pm-card__head' },
          h('div', { className: 'pm-label' },
            h('div', { className: 'pm-card__title' }, t('langSection')),
            h('div', { className: 'pm-card__hint' }, t('langSectionHint'))),
          langOptions.length > 0 ? h('label', { className: 'pm-picker' },
            h('span', { className: 'pm-picker__label' }, t('editingLang')),
            h('select', {
              value: activeLangId,
              'aria-label': t('editingLang'),
              onChange: e => onSelectLang(e.target.value),
            }, langOptions.map(opt => h('option', { key: opt.id, value: opt.id },
              opt.label === opt.id ? opt.id : `${opt.label} · ${opt.id}`)))) : null),

        langOptions.length === 0
          ? h('div', { className: 'pm-note' }, t('noLanguages'))
          : h(React.Fragment, null,
            h('div', { className: 'pm-subsection' },
              h('div', { className: 'pm-subsection__title' }, t('messages')),
              h('div', { className: 'pm-subsection__hint' }, t('messagesHint')),
              activePack ? h(React.Fragment, null,
                h('div', { className: 'pm-field' },
                  h('span', { className: 'pm-field__label' }, t('key_sidebar_new')),
                  h('input', {
                    type: 'text',
                    value: activePack.dictionaries?.sidebar?.['session.new'] || '',
                    onChange: e => onEditMessages(activePack, 'sidebar', {
                      'session.new': e.target.value,
                      'session.new.label': e.target.value,
                    }),
                  })),
                h('div', { className: 'pm-field' },
                  h('span', { className: 'pm-field__label' }, t('key_hero_headline')),
                  h('input', {
                    type: 'text',
                    value: activePack.dictionaries?.conversation?.['hero.headline'] || '',
                    onChange: e => onEditMessages(activePack, 'conversation', {
                      'hero.headline': e.target.value,
                    }),
                  }))) : h('div', { className: 'pm-note' }, t('noLocalePackForLang'))),

            h('div', { className: 'pm-subsection' },
              h('div', { className: 'pm-subsection__title' }, t('phrases')),
              h('div', { className: 'pm-subsection__hint' }, t('phrasesHint')),
              hasRotPack ? h(React.Fragment, null,
                h('div', { className: 'pm-field' },
                  h('textarea', {
                    value: phraseText,
                    onChange: e => onEditPhrases(activeLangId, e.target.value),
                  })),
                h('div', { className: 'pm-field' },
                  h('span', { className: 'pm-field__label' }, t('interval')),
                  h('input', {
                    type: 'number',
                    min: 100,
                    step: 100,
                    value: intervalText,
                    onChange: e => onEditInterval(e.target.value),
                  }))) : h('div', { className: 'pm-note' }, t('noLanguages'))),

            h('div', { className: 'pm-subsection' },
              h('div', { className: 'pm-subsection__title' }, t('persona')),
              h('div', { className: 'pm-subsection__hint' }, t('personaHint')),
              hasPromptPack ? h('div', { className: 'pm-field' },
                h('textarea', {
                  className: 'pm-prompt-area',
                  value: promptText,
                  onChange: e => onEditPrompt(activeLangId, e.target.value),
                })) : h('div', { className: 'pm-note' }, t('noPrompts')))))
    }

    function Panel({ forms, savePatch, t, locale, subscribeUi, ensureLocale, localeSwitcher }) {
      const [snapshots, setSnapshots] = useState({})
      const [status, setStatus] = useState('loading')
      const [error, setError] = useState(undefined)
      const [dirty, setDirty] = useState(false)
      const [selectedLang, setSelectedLang] = useState('')
      const [phraseDrafts, setPhraseDrafts] = useState({})
      const [intervalDraft, setIntervalDraft] = useState(null)
      const [, setUiVersion] = useState(0)
      const dirtyRef = useRef(false)
      const savedRef = useRef(null)

      const ids = useMemo(() => Object.keys(forms), [forms])

      useEffect(() => {
        ensureLocale(readActive(locale))
        return subscribeUi(() => setUiVersion(v => v + 1))
      }, [subscribeUi, ensureLocale, locale])

      const syncFromForms = useCallback(() => {
        const next = {}
        let ready = 0
        for (const id of ids) {
          const snap = forms[id].getSnapshot()
          next[id] = snap
          if (snap.status === 'ready') ready++
        }
        setSnapshots(next)
        const hasError = Object.values(next).some(s => s.status === 'error')
        setStatus(ready === ids.length && ids.length ? 'ready' : (hasError ? 'error' : 'loading'))
      }, [ids, forms])

      useEffect(() => {
        let disposed = false
        const refresh = () => { if (!disposed && !dirtyRef.current) syncFromForms() }
        const unsubs = ids.map(id => forms[id].subscribe(refresh))
        refresh()
        return () => { disposed = true; for (const u of unsubs) { try { u() } catch {} } }
      }, [ids, forms, syncFromForms])

      const valueOf = (id) => {
        const snap = snapshots[id]
        return snap && snap.status === 'ready' && isPlainObject(snap.value) ? snap.value : {}
      }

      const baseOf = (id) => {
        const snap = snapshots[id]
        return snap && isPlainObject(snap.base) ? snap.base : {}
      }

      const setLocal = (id, patch) => {
        dirtyRef.current = true
        setSnapshots(prev => {
          const snap = prev[id]
          if (!snap || snap.status !== 'ready') return prev
          return { ...prev, [id]: { ...snap, value: { ...snap.value, ...patch } } }
        })
        setDirty(true)
      }

      const buildNormalizedRotatePack = () => {
        const currentRot = valueOf(ROTATE).pack
        if (!isPlainObject(currentRot)) return currentRot
        const basePhrases = isPlainObject(currentRot.phrases) ? { ...currentRot.phrases } : {}
        for (const [id, rawText] of Object.entries(phraseDrafts)) {
          basePhrases[id] = parsePhraseLines(rawText)
        }
        const rawInterval = intervalDraft !== null ? intervalDraft : currentRot.intervalMs
        return {
          ...currentRot,
          phrases: basePhrases,
          intervalMs: clampInterval(rawInterval, DEFAULT_INTERVAL_MS),
        }
      }

      const commit = async () => {
        setStatus('saving')
        setError(undefined)
        try {
          const prevPacks = forms[LOCALE].getSnapshot().value?.packs
          const wasDisabled = Array.isArray(prevPacks) && prevPacks.length === 0
          const currentPacks = Array.isArray(valueOf(LOCALE).packs) ? valueOf(LOCALE).packs : []
          const patch = {
            [BRAND]: { pack: valueOf(BRAND).pack },
            [LOCALE]: { packs: currentPacks, pack: valueOf(LOCALE).pack },
            [ROTATE]: { pack: buildNormalizedRotatePack() },
            [PROMPT]: { pack: valueOf(PROMPT).pack },
          }

          const active = readActive(locale)
          let pendingLocaleTarget = null
          if (currentPacks.length === 0) {
            const knownPacks = [
              ...(Array.isArray(savedRef.current?.[LOCALE]?.packs) ? savedRef.current[LOCALE].packs : []),
              ...(Array.isArray(baseOf(LOCALE).packs) ? baseOf(LOCALE).packs : []),
            ]
            const activePack = knownPacks.find(p => p && p.id === active)
            if (activePack) patch[LOCALE_PREF] = { preference: activePack.fallback || 'en' }
          } else if (wasDisabled) {
            const match = findPiratePackFor(currentPacks, active)
            if (match) pendingLocaleTarget = match.id
          }

          await savePatch(patch)
          dirtyRef.current = false
          setPhraseDrafts({})
          setIntervalDraft(null)
          setDirty(false)
          syncFromForms()
          setStatus('saved')
          if (pendingLocaleTarget) localeSwitcher.switchWhenRegistered(pendingLocaleTarget)
        } catch (cause) {
          setError(String(cause && cause.message ? cause.message : cause))
          setStatus('error')
        }
      }

      if (status === 'loading') return h('div', { className: 'pm-panel' }, h('div', { className: 'pm-note' }, t('loading')))
      if (status === 'error' && !dirty) {
        return h('div', { className: 'pm-panel' },
          h('div', { className: 'pm-error' }, t('loadFailed')),
          error ? h('div', { className: 'pm-note' }, error) : null)
      }

      const brandPack = valueOf(BRAND).pack
      const brandBase = baseOf(BRAND).pack
      const brandSlotOn = (slot) => isPlainObject(brandPack) && Boolean(brandPack[slot])
      const brandOn = BRAND_SLOTS.some(([slot]) => brandSlotOn(slot))

      const setBrandSlot = (slot, mode) => {
        if (mode === 'pirate') {
          const source = (isPlainObject(savedRef.current?.[BRAND]) ? savedRef.current[BRAND][slot] : undefined)
            || (isPlainObject(brandBase) ? brandBase[slot] : undefined)
          if (!source) return
          const next = isPlainObject(brandPack)
            ? { ...brandPack }
            : { id: (isPlainObject(brandBase) && brandBase.id) || 'pirate', sidebarMark: false, heroMark: false, wordmark: false }
          next[slot] = source
          setLocal(BRAND, { pack: next })
          return
        }
        if (!isPlainObject(brandPack)) return
        const next = { ...brandPack, [slot]: false }
        const anyLeft = BRAND_SLOTS.some(([s]) => Boolean(next[s]))
        setLocal(BRAND, { pack: anyLeft ? next : false })
      }

      const localePacks = valueOf(LOCALE).packs
      const packs = Array.isArray(localePacks) ? localePacks : []

      const rotPack = valueOf(ROTATE).pack
      const hasRotPack = isPlainObject(rotPack)
      const phrases = hasRotPack && isPlainObject(rotPack.phrases) ? rotPack.phrases : {}
      const intervalMs = hasRotPack && typeof rotPack.intervalMs === 'number' ? rotPack.intervalMs : DEFAULT_INTERVAL_MS
      const rotOn = hasRotPack && Object.keys(phrases).length > 0

      const promptPack = valueOf(PROMPT).pack
      const hasPromptPack = isPlainObject(promptPack)
      const promptTexts = hasPromptPack && isPlainObject(promptPack.texts) ? promptPack.texts : {}
      const promptOn = hasPromptPack && Object.values(promptTexts).some(v => typeof v === 'string' && v.trim())

      const langOptions = collectLanguageOptions(packs, phrases, promptTexts)
      const activeLangId = langOptions.some(o => o.id === selectedLang)
        ? selectedLang
        : pickDefaultLang(langOptions, readActive(locale))
      const activePack = packs.find(p => p.id === activeLangId) || null

      const onEditPhrases = (id, text) => {
        if (!hasRotPack || !id) return
        dirtyRef.current = true
        setPhraseDrafts(prev => ({ ...prev, [id]: String(text) }))
        setDirty(true)
      }

      const onEditInterval = (rawText) => {
        if (!hasRotPack) return
        dirtyRef.current = true
        setIntervalDraft(String(rawText))
        setDirty(true)
      }

      const onEditPrompt = (id, text) => {
        if (!hasPromptPack || !id) return
        setLocal(PROMPT, { pack: { ...promptPack, texts: { ...promptTexts, [id]: String(text) } } })
      }

      const onEditMessages = (pack, group, updates) => {
        const dictionaries = { ...(pack.dictionaries || {}) }
        dictionaries[group] = { ...(dictionaries[group] || {}), ...updates }
        const next = packs.map(p => (p.id === pack.id ? { ...p, dictionaries } : p))
        setLocal(LOCALE, { packs: next })
      }

      const masterOn = brandOn || packs.length > 0 || rotOn || promptOn
      const toggleMaster = (on) => {
        if (!on) {
          savedRef.current = {
            [BRAND]: valueOf(BRAND).pack,
            [LOCALE]: { packs: valueOf(LOCALE).packs, pack: valueOf(LOCALE).pack },
            [ROTATE]: buildNormalizedRotatePack(),
            [PROMPT]: valueOf(PROMPT).pack,
          }
          setPhraseDrafts({})
          setIntervalDraft(null)
          setLocal(BRAND, { pack: false })
          setLocal(LOCALE, { packs: [], pack: false })
          setLocal(ROTATE, { pack: false })
          setLocal(PROMPT, { pack: false })
          return
        }
        const saved = savedRef.current || {}
        const baseLocale = baseOf(LOCALE)
        setLocal(BRAND, { pack: restoreObject(saved[BRAND], brandBase) })
        setLocal(LOCALE, {
          packs: restorePacks(saved[LOCALE]?.packs, baseLocale.packs),
          pack: saved[LOCALE]?.pack !== undefined ? saved[LOCALE].pack : (baseLocale.pack ?? false),
        })
        setLocal(ROTATE, { pack: restoreObject(saved[ROTATE], baseOf(ROTATE).pack) })
        setLocal(PROMPT, { pack: restoreObject(saved[PROMPT], baseOf(PROMPT).pack) })
        savedRef.current = null
      }

      const phraseText = activeLangId && Object.prototype.hasOwnProperty.call(phraseDrafts, activeLangId)
        ? phraseDrafts[activeLangId]
        : (phrases[activeLangId] || []).join('\n')
      const intervalText = intervalDraft !== null ? intervalDraft : String(intervalMs)

      return h('div', { className: 'pm-panel' },
        h('div', { className: 'pm-head' },
          h('div', { className: 'pm-head__hint' }, t('hint'))),
        error ? h('div', { className: 'pm-error' }, error) : null,
        h(MasterCard, { masterOn, onToggle: toggleMaster, t }),
        h(BrandCard, { brandSlotOn, onSlotChange: setBrandSlot, t }),
        h(LanguageCard, {
          langOptions,
          activeLangId,
          onSelectLang: setSelectedLang,
          activePack,
          onEditMessages,
          hasRotPack,
          phraseText,
          onEditPhrases,
          intervalText,
          onEditInterval,
          hasPromptPack,
          promptText: promptTexts[activeLangId] || '',
          onEditPrompt,
          t,
        }),
        h('div', { className: 'pm-note' }, t('oceanNote')),
        h('button', { type: 'button', className: 'pm-save', disabled: status === 'saving', onClick: commit },
          status === 'saving' ? t('saving') : (status === 'saved' && !dirty ? t('saved') : t('save'))))
    }

    return {
      inject: ['slots', 'locale', 'configForms', 'remote', 'remote.settings'],
      apply(ctx) {
        const uiCatalog = new Map()
        const pendingFetches = new Map()
        const uiListeners = new Set()
        const localeDisposers = new Map()
        const localeSwitcher = createLocaleSwitcher(ctx.locale)
        let disposed = false

        const notifyUi = () => {
          for (const listener of [...uiListeners]) {
            try { listener() } catch {}
          }
        }
        const subscribeUi = (listener) => {
          uiListeners.add(listener)
          return () => uiListeners.delete(listener)
        }

        const loadLocaleUi = (lang) => {
          const requested = String(lang || 'en').trim() || 'en'
          const key = primarySubtag(requested) || 'en'
          if (uiCatalog.has(key) || pendingFetches.has(key) || typeof fetch !== 'function') return
          const promise = fetch(`${LOCALE_ROUTE}${encodeURIComponent(requested)}.json`)
            .then(res => (res && res.ok ? res.json() : null))
            .then(payload => {
              if (disposed || !payload || !isPlainObject(payload.ui)) return
              const resolved = primarySubtag(payload.lang) || key
              uiCatalog.set(key, payload.ui)
              uiCatalog.set(resolved, payload.ui)
              if (!localeDisposers.has(resolved) && typeof ctx.locale.register === 'function') {
                try {
                  localeDisposers.set(resolved, ctx.locale.register(NS, resolved, payload.ui))
                } catch {}
              }
              registerNavIcon(payload.ui.nav)
              notifyUi()
            })
            .catch(() => {})
            .finally(() => pendingFetches.delete(key))
          pendingFetches.set(key, promise)
        }

        ctx.effect(() => {
          loadLocaleUi(readActive(ctx.locale))
          const unsub = typeof ctx.locale.subscribe === 'function'
            ? ctx.locale.subscribe(() => {
              loadLocaleUi(readActive(ctx.locale))
              notifyUi()
            })
            : undefined
          return () => {
            disposed = true
            localeSwitcher.cancel()
            try { unsub?.() } catch {}
            for (const dispose of localeDisposers.values()) {
              try { dispose?.() } catch {}
            }
            localeDisposers.clear()
            uiListeners.clear()
          }
        }, 'dsh-pirate-mode: dynamic ui locales')

        const t = (key) => {
          const active = readActive(ctx.locale)
          const subtag = primarySubtag(active)
          const dict = (active && uiCatalog.get(active))
            || (subtag && uiCatalog.get(subtag))
            || uiCatalog.get('en')
            || uiCatalog.values().next().value
          if (dict && typeof dict[key] === 'string') return dict[key]
          if (key === 'nav') return subtag === 'zh' ? '海盗模式' : 'Pirate mode'
          return key
        }

        const forms = {
          [BRAND]: ctx.configForms.get(BRAND),
          [LOCALE]: ctx.configForms.get(LOCALE),
          [ROTATE]: ctx.configForms.get(ROTATE),
          [PROMPT]: ctx.configForms.get(PROMPT),
        }
        const localePrefForm = ctx.configForms.get(LOCALE_PREF)

        // First-time auto-selection: switch from the user's current base language
        // to its matching pirate locale pack via each pack's `fallback` field.
        ctx.effect(() => {
          if (readAutoLocaleDone() || typeof ctx.locale.setLocale !== 'function') return
          let finished = false
          let unsubForm
          const stop = () => {
            finished = true
            try { unsubForm?.() } catch {}
            unsubForm = undefined
          }
          const trySelect = () => {
            if (finished || readAutoLocaleDone()) { stop(); return }
            const snap = forms[LOCALE].getSnapshot()
            if (snap.status !== 'ready') return
            const packs = Array.isArray(snap.value?.packs) ? snap.value.packs : []
            if (!packs.length) return
            const active = readActive(ctx.locale)
            if (!active) return
            if (packs.some(p => p && p.id === active)) {
              markAutoLocaleDone()
              stop()
              return
            }
            const match = findPiratePackFor(packs, active)
            if (!match) {
              markAutoLocaleDone()
              stop()
              return
            }
            stop()
            localeSwitcher.switchWhenRegistered(match.id, markAutoLocaleDone)
          }
          unsubForm = forms[LOCALE].subscribe(trySelect)
          trySelect()
          return () => { stop(); localeSwitcher.cancel() }
        }, 'dsh-pirate-mode: auto locale')

        const savePatch = async (patch) => {
          const settingsRemote = ctx.remote?.settings
          if (!settingsRemote) throw new Error('settingsRemoteUnavailable')
          for (const [namespace, fields] of Object.entries(patch)) {
            const ops = Object.entries(fields)
              .filter(([, value]) => value !== undefined)
              .map(([field, value]) => ({ op: 'set', path: [field], value }))
            if (ops.length === 0) continue
            const form = forms[namespace] || (namespace === LOCALE_PREF ? localePrefForm : ctx.configForms.get(namespace))
            if (!form) continue
            const snap = form.getSnapshot()
            const response = await settingsRemote.mutate(namespace, ops, snap.revision)
            if (response.ok) {
              ctx.configForms.describe().acceptView(response.value)
            } else {
              await ctx.configForms.describe().load()
              throw new Error(response.error?.message || response.error?.code || 'persistFailed')
            }
          }
        }

        ctx.slots.inject('settings.section', () => ctx.slots.register(
          { name: 'settings.section', id: 'pirate-mode', order: 85, label: () => t('nav'), locale: NS },
          () => h(Panel, { forms, savePatch, t, locale: ctx.locale, subscribeUi, ensureLocale: loadLocaleUi, localeSwitcher }),
        ))

        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-plugin', 'dsh-pirate-mode')
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'dsh-pirate-mode: settings styles')
      },
    }
  },
})
