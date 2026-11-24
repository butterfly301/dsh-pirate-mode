// Entry shell for dsh-pirate-mode. Wraps hero.headline with the ship name,
// handles dynamic UI locales and first-time auto-locale switching, and lazy-loads
// the modular settings panel from /pirate-mode/client/panel.js.

window.__ModuleLoader__.load({
  id: 'dsh-pirate-mode',
  factory(require) {
    const React = require('react');
    const { useState, useEffect } = React;
    const h = React.createElement;

    const NS = 'pirate-mode-ui';
    const LOCALE_ROUTE = '/pirate-mode/locale/';
    const IDENTITY_URL = '/pirate-mode/identity.js';
    const IDENTITY_TEMPLATES_URL = '/pirate-mode/identity-templates.json';
    const PANEL_URL = '/pirate-mode/client/panel.js';
    const STYLES_URL = '/pirate-mode/client/styles.css';

    const PIRATE_MODE = 'pirate-mode';
    const BRAND = 'brand-pack-loader';
    const LOCALE = 'locale-pack-loader';
    const ROTATE = 'dsh-rotate-status-text';
    const PROMPT = 'prompt-loader';
    const SOUND = 'dsh-sound-pack-loader';
    const CONFETTI = 'dsh-confetti';
    const MORALE = 'dsh-crew-morale';
    const SHAKE = 'dsh-window-shake';
    const LOCALE_PREF = 'locale';
    const AUTO_LOCALE_KEY = 'dsh-pirate-mode:auto-locale-v1';

    const primarySubtag = (lang) => String(lang ?? '').split(/[-_]/)[0].toLowerCase();
    const isPlainObject = (v) => Boolean(v && typeof v === 'object' && !Array.isArray(v));

    function readActive(locale) {
      try {
        const snap = typeof locale.getSnapshot === 'function' ? locale.getSnapshot() : undefined;
        return snap && (snap.active ?? snap.locale ?? snap.preference);
      } catch {
        return undefined;
      }
    }

    function findPiratePackFor(packs, active) {
      if (!Array.isArray(packs) || !active) return undefined;
      if (packs.some((p) => p && p.id === active)) return undefined;
      const want = primarySubtag(active);
      return packs.find((p) => p && p.fallback === active)
        || packs.find((p) => p && primarySubtag(p.fallback) === want);
    }

    function pickLocalizedSync(map, active) {
      if (!isPlainObject(map)) return undefined;
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

    function formatHeroHeadlineSync({ baseText, identity, fallbackTemplates, langId, isPirateLocale }) {
      if (!isPirateLocale || !baseText) return baseText;
      const templates = {
        ...(isPlainObject(fallbackTemplates) ? fallbackTemplates : {}),
        ...(isPlainObject(identity?.templates) ? identity.templates : {}),
      };
      const override = identity?.shipNameOverride;
      const tpl = pickLocalizedSync(templates, langId);
      const shipName = typeof override === 'string'
        ? override.trim()
        : (typeof tpl?.defaultShipName === 'string' ? tpl.defaultShipName.trim() : '');
      if (!shipName) return baseText;
      const subtag = primarySubtag(langId);
      const defaultPrefix = subtag === 'zh' || subtag === 'ja' ? '{shipName}，{headline}' : '{shipName}, {headline}';
      const prefixTpl = tpl && typeof tpl.heroPrefixTemplate === 'string' && tpl.heroPrefixTemplate.trim()
        ? tpl.heroPrefixTemplate
        : defaultPrefix;
      return prefixTpl.split('{shipName}').join(shipName).split('{headline}').join(baseText);
    }

    function registerNavIcon(label) {
      if (!label) return;
      const entry = { [label]: 'anchor' };
      if (window.__navicIcons !== undefined) window.__navicIcons.register(entry);
      else if (Array.isArray(window.__navicIconQueue)) window.__navicIconQueue.push(entry);
      else window.__navicIconQueue = [entry];
    }

    function readAutoLocaleDone() {
      try { return window.localStorage?.getItem(AUTO_LOCALE_KEY) === '1'; } catch { return false; }
    }

    function markAutoLocaleDone() {
      try { window.localStorage?.setItem(AUTO_LOCALE_KEY, '1'); } catch {}
    }

    function createLocaleSwitcher(locale) {
      let cancelPending = null;
      const cancel = () => {
        if (!cancelPending) return;
        const fn = cancelPending;
        cancelPending = null;
        try { fn(); } catch {}
      };
      const switchWhenRegistered = (targetId, onDone) => {
        cancel();
        if (!targetId || typeof locale.setLocale !== 'function') return;
        const attempt = () => {
          try {
            locale.setLocale(targetId);
            cancel();
            onDone?.();
            return true;
          } catch {
            return false;
          }
        };
        if (attempt()) return;
        if (typeof locale.subscribe !== 'function') return;
        const unsub = locale.subscribe(() => { attempt(); });
        cancelPending = unsub;
      };
      return { switchWhenRegistered, cancel };
    }

    return {
      inject: ['slots', 'locale', 'configForms', 'remote', 'remote.settings'],
      apply(ctx) {
        const uiCatalog = new Map();
        const pendingFetches = new Map();
        const uiListeners = new Set();
        const localeDisposers = new Map();
        const localeSwitcher = createLocaleSwitcher(ctx.locale);
        let identityApi = null;
        let bundledTemplates = {};
        let onHeroDepsChanged = null;
        let disposed = false;

        import(IDENTITY_URL).then((mod) => {
          if (!disposed) {
            identityApi = mod;
            onHeroDepsChanged?.();
          }
        }).catch(() => {});

        if (typeof fetch === 'function') {
          fetch(IDENTITY_TEMPLATES_URL, { cache: 'no-store' })
            .then((res) => (res && res.ok ? res.json() : null))
            .then((payload) => {
              if (!disposed && isPlainObject(payload)) {
                bundledTemplates = payload;
                onHeroDepsChanged?.();
              }
            })
            .catch(() => {});
        }

        const notifyUi = () => {
          for (const listener of [...uiListeners]) {
            try { listener(); } catch {}
          }
        };
        const subscribeUi = (listener) => {
          uiListeners.add(listener);
          return () => uiListeners.delete(listener);
        };

        const loadLocaleUi = (lang) => {
          const requested = String(lang || 'en').trim() || 'en';
          const key = primarySubtag(requested) || 'en';
          if (uiCatalog.has(key) || pendingFetches.has(key) || typeof fetch !== 'function') return;
          const promise = fetch(`${LOCALE_ROUTE}${encodeURIComponent(requested)}.json`)
            .then((res) => (res && res.ok ? res.json() : null))
            .then((payload) => {
              if (disposed || !payload || !isPlainObject(payload.ui)) return;
              const resolved = primarySubtag(payload.lang) || key;
              uiCatalog.set(key, payload.ui);
              uiCatalog.set(resolved, payload.ui);
              if (!localeDisposers.has(resolved) && typeof ctx.locale.register === 'function') {
                try {
                  localeDisposers.set(resolved, ctx.locale.register(NS, resolved, payload.ui));
                } catch {}
              }
              registerNavIcon(payload.ui.nav);
              notifyUi();
            })
            .catch(() => {})
            .finally(() => pendingFetches.delete(key));
          pendingFetches.set(key, promise);
        };

        ctx.effect(() => {
          loadLocaleUi(readActive(ctx.locale));
          const unsub = typeof ctx.locale.subscribe === 'function'
            ? ctx.locale.subscribe(() => {
              loadLocaleUi(readActive(ctx.locale));
              notifyUi();
            })
            : undefined;
          return () => {
            disposed = true;
            localeSwitcher.cancel();
            try { unsub?.(); } catch {}
            for (const dispose of localeDisposers.values()) {
              try { dispose?.(); } catch {}
            }
            localeDisposers.clear();
            uiListeners.clear();
          };
        }, 'dsh-pirate-mode: dynamic ui locales');

        const t = (key) => {
          const active = readActive(ctx.locale);
          const subtag = primarySubtag(active);
          const dict = (active && uiCatalog.get(active))
            || (subtag && uiCatalog.get(subtag))
            || uiCatalog.get('en')
            || uiCatalog.values().next().value;
          if (dict && typeof dict[key] === 'string') return dict[key];
          if (key === 'nav') return subtag === 'zh' ? '海盗模式' : 'Pirate mode';
          return key;
        };

        const forms = {
          [PIRATE_MODE]: ctx.configForms.get(PIRATE_MODE),
          [BRAND]: ctx.configForms.get(BRAND),
          [LOCALE]: ctx.configForms.get(LOCALE),
          [ROTATE]: ctx.configForms.get(ROTATE),
          [PROMPT]: ctx.configForms.get(PROMPT),
          [SOUND]: ctx.configForms.get(SOUND),
          [CONFETTI]: ctx.configForms.get(CONFETTI),
          [MORALE]: ctx.configForms.get(MORALE),
          [SHAKE]: ctx.configForms.get(SHAKE),
        };
        const localePrefForm = ctx.configForms.get(LOCALE_PREF);

        ctx.effect(() => {
          const locale = ctx.locale;
          if (!locale || typeof locale.translate !== 'function') return undefined;
          let holder = locale;
          let own = Object.getOwnPropertyDescriptor(holder, 'translate');
          const original = locale.translate;
          let active = true;
          let bumping = false;

          const readPacks = () => {
            const locSnap = forms[LOCALE].getSnapshot();
            if (locSnap.status === 'ready' && Array.isArray(locSnap.value?.packs)) return locSnap.value.packs;
            return Array.isArray(locSnap.base?.packs) ? locSnap.base.packs : [];
          };
          const isPirateLang = (activeLang, packs) => Boolean(
            activeLang && packs.some((p) => p && String(p.id || '').toLowerCase() === String(activeLang).toLowerCase()),
          );

          const bumpLocaleRevision = () => {
            if (disposed || !active || bumping) return;
            bumping = true;
            try {
              if (typeof locale.publish === 'function') {
                locale.publish(readActive(locale), false);
              } else if (typeof locale.register === 'function') {
                const off = locale.register('pirate-mode-hero-tick', 'en', {});
                if (typeof off === 'function') off();
              }
            } catch {} finally {
              bumping = false;
            }
          };

          const computeSignature = () => {
            const activeLang = readActive(locale);
            const packs = readPacks();
            const isPirate = isPirateLang(activeLang, packs);
            const modeSnap = forms[PIRATE_MODE].getSnapshot();
            const identity = modeSnap.status === 'ready' && isPlainObject(modeSnap.value?.identity)
              ? modeSnap.value.identity
              : (isPlainObject(modeSnap.base?.identity) ? modeSnap.base.identity : {});
            const tplCount = Object.keys({
              ...bundledTemplates,
              ...(isPlainObject(modeSnap.base?.identity?.templates) ? modeSnap.base.identity.templates : {}),
              ...(isPlainObject(identity?.templates) ? identity.templates : {}),
            }).length;
            return JSON.stringify([activeLang || '', isPirate, modeSnap.status, identity?.shipNameOverride ?? null, tplCount]);
          };

          let lastSignature = computeSignature();
          const checkHeroSync = () => {
            if (!active || disposed) return;
            const next = computeSignature();
            if (next !== lastSignature) {
              lastSignature = next;
              bumpLocaleRevision();
            }
          };
          onHeroDepsChanged = checkHeroSync;
          const unsubMode = typeof forms[PIRATE_MODE]?.subscribe === 'function'
            ? forms[PIRATE_MODE].subscribe(checkHeroSync)
            : undefined;
          const unsubLoc = typeof forms[LOCALE]?.subscribe === 'function'
            ? forms[LOCALE].subscribe(checkHeroSync)
            : undefined;

          const patched = function (ns, key, params) {
            const baseText = original.apply(this === undefined ? locale : this, [ns, key, params]);
            if (!active || ns !== 'conversation' || key !== 'hero.headline' || typeof baseText !== 'string' || !baseText) {
              return baseText;
            }
            const activeLang = readActive(locale);
            const isPirateLocale = isPirateLang(activeLang, readPacks());
            if (!isPirateLocale) return baseText;

            const modeSnap = forms[PIRATE_MODE].getSnapshot();
            const identity = modeSnap.status === 'ready' && isPlainObject(modeSnap.value?.identity)
              ? modeSnap.value.identity
              : (isPlainObject(modeSnap.base?.identity) ? modeSnap.base.identity : {});
            const fallbackTemplates = {
              ...bundledTemplates,
              ...(isPlainObject(modeSnap.base?.identity?.templates) ? modeSnap.base.identity.templates : {}),
            };
            const formatHeadline = identityApi?.formatHeroHeadline || formatHeroHeadlineSync;
            return formatHeadline({
              baseText,
              identity,
              fallbackTemplates,
              langId: activeLang,
              isPirateLocale,
            });
          };

          try {
            Object.defineProperty(holder, 'translate', {
              value: patched,
              writable: true,
              configurable: true,
              enumerable: own !== undefined && own.enumerable === true,
            });
          } catch {
            holder = Object.getPrototypeOf(locale);
            if (!holder || typeof holder.translate !== 'function') return undefined;
            own = Object.getOwnPropertyDescriptor(holder, 'translate');
            Object.defineProperty(holder, 'translate', {
              value: patched,
              writable: true,
              configurable: true,
              enumerable: own !== undefined && own.enumerable === true,
            });
          }

          checkHeroSync();

          return () => {
            active = false;
            onHeroDepsChanged = null;
            try { unsubMode?.(); } catch {}
            try { unsubLoc?.(); } catch {}
            if (holder.translate === patched) {
              if (own === undefined) delete holder.translate;
              else Object.defineProperty(holder, 'translate', own);
            }
          };
        }, 'dsh-pirate-mode: hero headline ship prefix');

        ctx.effect(() => {
          if (readAutoLocaleDone() || typeof ctx.locale.setLocale !== 'function') return;
          let finished = false;
          let unsubForm;
          const stop = () => {
            finished = true;
            try { unsubForm?.(); } catch {}
            unsubForm = undefined;
          };
          const trySelect = () => {
            if (finished || readAutoLocaleDone()) { stop(); return; }
            const snap = forms[LOCALE].getSnapshot();
            if (snap.status !== 'ready') return;
            const packs = Array.isArray(snap.value?.packs) ? snap.value.packs : [];
            if (!packs.length) return;
            const active = readActive(ctx.locale);
            if (!active) return;
            if (packs.some((p) => p && p.id === active)) {
              markAutoLocaleDone();
              stop();
              return;
            }
            const match = findPiratePackFor(packs, active);
            if (!match) {
              markAutoLocaleDone();
              stop();
              return;
            }
            stop();
            localeSwitcher.switchWhenRegistered(match.id, markAutoLocaleDone);
          };
          unsubForm = forms[LOCALE].subscribe(trySelect);
          trySelect();
          return () => { stop(); localeSwitcher.cancel(); };
        }, 'dsh-pirate-mode: auto locale');

        const savePatch = async (opsByNs) => {
          const entries = Object.entries(opsByNs).filter(([, ops]) => Array.isArray(ops) && ops.length > 0);
          if (entries.length === 0) return;
          const settingsRemote = ctx.remote?.settings;
          if (!settingsRemote) throw new Error('settingsRemoteUnavailable');
          const savedNamespaces = [];
          for (const [namespace, ops] of entries) {
            const form = forms[namespace] || (namespace === LOCALE_PREF ? localePrefForm : ctx.configForms.get(namespace));
            if (!form) continue;
            const snap = form.getSnapshot();
            const response = await settingsRemote.mutate(namespace, ops, snap.revision);
            if (response.ok) {
              ctx.configForms.describe().acceptView(response.value);
              savedNamespaces.push(namespace);
            } else {
              await ctx.configForms.describe().load();
              const err = new Error(response.error?.message || response.error?.code || 'persistFailed');
              if (savedNamespaces.length > 0) {
                err.partialSaved = savedNamespaces;
                err.failedNamespace = namespace;
              }
              throw err;
            }
          }
        };

        let cachedPanel = null;
        function LazyPanel() {
          const [PanelComp, setPanelComp] = useState(() => cachedPanel);
          const [loadErr, setLoadErr] = useState(null);
          useEffect(() => {
            if (cachedPanel) return undefined;
            let cancelled = false;
            import(PANEL_URL)
              .then((mod) => {
                const comp = mod.createPanel(React);
                cachedPanel = comp;
                if (!cancelled) setPanelComp(() => comp);
              })
              .catch((err) => {
                if (!cancelled) setLoadErr(err?.message || String(err));
              });
            return () => { cancelled = true; };
          }, []);
          if (loadErr) return h('div', { className: 'pm-panel' }, h('div', { className: 'pm-error' }, loadErr));
          if (!PanelComp) return h('div', { className: 'pm-panel' }, h('div', { className: 'pm-note' }, t('loading')));
          return h(PanelComp, {
            forms,
            savePatch,
            t,
            locale: ctx.locale,
            subscribeUi,
            ensureLocale: loadLocaleUi,
            localeSwitcher,
            getBundledTemplates: () => bundledTemplates,
          });
        }

        ctx.slots.inject('settings.section', () => ctx.slots.register(
          { name: 'settings.section', id: 'pirate-mode', order: 85, label: () => t('nav'), locale: NS },
          () => h(LazyPanel),
        ));

        ctx.effect(() => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = STYLES_URL;
          link.setAttribute('data-plugin', 'dsh-pirate-mode');
          document.head.appendChild(link);
          return () => link.remove();
        }, 'dsh-pirate-mode: settings styles');
      },
    };
  },
});
