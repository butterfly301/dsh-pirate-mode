import {
  BRAND_ACCEPT,
  BRAND_SLOTS,
  DEFAULT_FLAG_IMAGE_ROUTE,
  FLAG_IMAGE_ROUTE,
  MAX_IDENTITY_NAME_LENGTH,
  MORALE_NUMERIC_FIELDS,
  MORALE_PHRASE_FIELDS,
  PHRASE_SEGMENTS,
  SOUND_ACCEPT,
  deepEqual,
  isPlainObject,
} from './helpers.js';

export function createCards(React) {
  const { useRef } = React;
  const h = React.createElement;

  function Switch({ checked, onChange, label }) {
    return h('label', { className: 'pm-switch' },
      h('input', { type: 'checkbox', checked, onChange: (e) => onChange(e.target.checked), 'aria-label': label }),
      h('span', { className: 'pm-switch__track' }, h('span', { className: 'pm-switch__thumb' })));
  }

  function Segmented({ value, onChange, a, b, valA = 'pirate', valB = 'original' }) {
    return h('div', { className: 'pm-seg' },
      h('button', { type: 'button', 'data-on': String(value === valA), onClick: () => onChange(valA) }, a),
      h('button', { type: 'button', 'data-on': String(value === valB), onClick: () => onChange(valB) }, b));
  }

  function MasterCard({ masterOn, onToggle, t }) {
    return h('div', { className: 'pm-card' },
      h('div', { className: 'pm-card__title' }, t('master')),
      h('div', { className: 'pm-card__hint' }, t('masterHint')),
      h('div', { className: 'pm-row' },
        h('div', { className: 'pm-label' },
          h('span', null, t('master')),
          h('span', { className: 'pm-label__sub' }, `${t('on')} / ${t('off')}`)),
        h(Switch, { checked: masterOn, onChange: onToggle, label: t('master') })));
  }

  function BrandPreview({ value, label }) {
    const image = typeof value === 'string' ? { src: value, tint: false } : value;
    if (!isPlainObject(image) || typeof image.src !== 'string' || !image.src) return null;
    if (image.tint && Number.isFinite(image.width) && image.width > 0 && Number.isFinite(image.height) && image.height > 0) {
      const mask = `url("${image.src}") center / contain no-repeat`;
      return h('span', { className: 'pm-brand-thumb', title: label },
        h('span', {
          'aria-hidden': true,
          style: {
            display: 'block',
            height: 18,
            width: Math.min(128, Math.max(18, Math.round(18 * image.width / image.height))),
            backgroundColor: 'currentColor',
            mask,
            WebkitMask: mask,
          },
        }));
    }
    return h('span', { className: 'pm-brand-thumb', title: label },
      h('img', { src: image.src, alt: label, draggable: false }));
  }

  function BrandCard({ brandPack, brandBase, brandErrors, onToggleSlot, onImportSlot, onResetSlot, t }) {
    const inputRefs = useRef({});
    return h('div', { className: 'pm-card' },
      h('div', { className: 'pm-card__title' }, t('brand')),
      h('div', { className: 'pm-card__hint' }, t('brandHint')),
      BRAND_SLOTS.map(([slot, labelKey]) => {
        const val = isPlainObject(brandPack) ? brandPack[slot] : false;
        const on = Boolean(val);
        const baseVal = isPlainObject(brandBase) ? brandBase[slot] : undefined;
        const hasCustom = on && baseVal !== undefined && !deepEqual(val, baseVal);
        const err = brandErrors?.[slot] || '';
        return h('div', { className: 'pm-brand-row', key: slot },
          h('div', { className: 'pm-brand-row__head' },
            h('div', { className: 'pm-label' }, h('span', null, t(labelKey))),
            h(Switch, {
              checked: on,
              onChange: (checked) => onToggleSlot(slot, checked),
              label: t(labelKey),
            })),
          on ? h('div', { className: 'pm-brand-tools' },
            h(BrandPreview, { value: val, label: t(labelKey) }),
            h('input', {
              ref: (el) => { inputRefs.current[slot] = el; },
              type: 'file',
              accept: BRAND_ACCEPT,
              style: { display: 'none' },
              onChange: (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onImportSlot(slot, file);
              },
            }),
            h('button', {
              type: 'button',
              className: 'pm-btn',
              onClick: () => inputRefs.current[slot]?.click(),
            }, t('uploadImage')),
            hasCustom ? h('button', {
              type: 'button',
              className: 'pm-btn',
              onClick: () => onResetSlot(slot),
            }, t('restoreDefault')) : null,
            h('span', { className: err ? 'pm-error' : 'pm-note' },
              err || (hasCustom ? t('brandCustom') : t('brandDefault')))) : null);
      }));
  }

  function IdentityCard({
    shipNameValue, isCustomShipName, onEditShipName, onRestoreShipName,
    mateNameValue, onEditMateName,
    heroPreview, personaPreview,
    flagState, onUploadFlag, onResetFlag, t,
  }) {
    const fileInputRef = useRef(null);
    const flagStatusText = flagState.available === false
      ? t('flagUnavailable')
      : (flagState.hasCustom ? t('flagCustom') : t('flagDefault'));
    const flagPreviewSrc = flagState.hasCustom
      ? `${FLAG_IMAGE_ROUTE}?v=${encodeURIComponent(String(flagState.version || 0))}`
      : DEFAULT_FLAG_IMAGE_ROUTE;
    return h('div', { className: 'pm-card' },
      h('div', { className: 'pm-card__title' }, t('identitySection')),
      h('div', { className: 'pm-card__hint' }, t('identitySectionHint')),
      h('div', { className: 'pm-field' },
        h('span', { className: 'pm-field__label' }, t('shipName')),
        h('div', { className: 'pm-inline' },
          h('input', {
            type: 'text',
            maxLength: MAX_IDENTITY_NAME_LENGTH,
            value: shipNameValue,
            onChange: (e) => onEditShipName(e.target.value),
          }),
          isCustomShipName ? h('button', {
            type: 'button',
            className: 'pm-btn',
            onClick: onRestoreShipName,
          }, t('restoreDefault')) : null),
        h('span', { className: 'pm-note' }, t('shipNameHint'))),
      h('div', { className: 'pm-field' },
        h('span', { className: 'pm-field__label' }, t('mateName')),
        h('input', {
          type: 'text',
          maxLength: MAX_IDENTITY_NAME_LENGTH,
          value: mateNameValue,
          onChange: (e) => onEditMateName(e.target.value),
        }),
        h('span', { className: 'pm-note' }, t('mateNameHint'))),
      h('div', { className: 'pm-preview' },
        heroPreview ? h('div', { className: 'pm-preview__row' },
          h('span', { className: 'pm-preview__label' }, t('identityPreviewHero')),
          h('span', { className: 'pm-preview__value' }, heroPreview)) : null,
        h('div', { className: 'pm-preview__row' },
          h('span', { className: 'pm-preview__label' }, t('identityPreviewPersona')),
          h('span', { className: 'pm-preview__value' }, personaPreview || t('identityPreviewEmpty')))),
      h('div', { className: 'pm-field' },
        h('span', { className: 'pm-field__label' }, t('shipFlag')),
        h('div', { className: 'pm-inline' },
          h('div', { className: 'pm-flag-preview' },
            h('img', { src: flagPreviewSrc, alt: t('shipFlag'), draggable: false })),
          h('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/png,image/jpeg,image/webp',
            style: { display: 'none' },
            onChange: (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onUploadFlag(file);
            },
          }),
          h('button', {
            type: 'button',
            className: 'pm-btn',
            disabled: flagState.available === false || flagState.busy,
            onClick: () => fileInputRef.current?.click(),
          }, t('uploadFlag')),
          h('button', {
            type: 'button',
            className: 'pm-btn',
            disabled: flagState.available === false || !flagState.hasCustom || flagState.busy,
            onClick: onResetFlag,
          }, t('restoreDefault')),
          h('span', { className: 'pm-note' }, flagState.message || flagStatusText)),
        h('span', { className: 'pm-note' }, t('shipFlagHint'))));
  }

  function SoundCard({ soundVal, soundCustom, onEditSound, onPreviewSound, onUploadSound, onResetSound, t }) {
    const inputRefs = useRef({});
    if (!isPlainObject(soundVal) || !isPlainObject(soundVal.pack)) return null;
    const events = isPlainObject(soundVal.events) ? soundVal.events : {};
    const volPct = Math.round((typeof soundVal.volume === 'number' ? soundVal.volume : 0.8) * 100);
    const triggerMode = soundVal.triggerMode === 'always' ? 'always' : 'background';
    const slots = isPlainObject(soundCustom?.slots) ? soundCustom.slots : {};
    const customAvailable = soundCustom?.available !== false;
    const busyKind = soundCustom?.busyKind || null;
    const eventRows = [
      ['completed', 'soundCompleted', true],
      ['failed', 'soundFailed', true],
      ['waiting', 'soundWaiting', false],
    ];
    return h('div', { className: 'pm-card' },
      h('div', { className: 'pm-card__title' }, t('soundSection')),
      h('div', { className: 'pm-card__hint' }, t('soundSectionHint')),
      h('div', { className: 'pm-row' },
        h('div', { className: 'pm-label' }, h('span', null, t('soundMuted'))),
        h(Switch, {
          checked: Boolean(soundVal.muted),
          onChange: (val) => onEditSound({ muted: val }),
          label: t('soundMuted'),
        })),
      h('div', { className: 'pm-row' },
        h('div', { className: 'pm-label' }, h('span', null, t('soundTriggerMode'))),
        h(Segmented, {
          value: triggerMode,
          valA: 'background',
          valB: 'always',
          a: t('soundTriggerBackground'),
          b: t('soundTriggerAlways'),
          onChange: (mode) => onEditSound({ triggerMode: mode }),
        })),
      h('div', { className: 'pm-field' },
        h('span', { className: 'pm-field__label' }, `${t('soundVolume')}: ${volPct}%`),
        h('input', {
          type: 'range',
          min: 0,
          max: 100,
          step: 5,
          value: volPct,
          onChange: (e) => onEditSound({ volume: Number(e.target.value) / 100 }),
        })),
      eventRows.map(([kind, labelKey, defVal]) => {
        const slot = isPlainObject(slots[kind]) ? slots[kind] : null;
        const hasCustom = Boolean(slot?.hasCustom);
        const sourceLabel = hasCustom && slot?.fileName ? slot.fileName : t('soundDefaultSlot');
        const rowMessage = soundCustom?.messageKind === kind ? soundCustom.message : '';
        const busy = busyKind === kind;
        return h('div', { className: 'pm-row', key: kind },
          h('div', { className: 'pm-label' },
            h('span', null, t(labelKey)),
            h('span', {
              className: 'pm-label__sub pm-sound-name',
              title: sourceLabel,
            }, rowMessage ? `${sourceLabel} · ${rowMessage}` : sourceLabel)),
          h('div', { className: 'pm-inline' },
            h('input', {
              ref: (el) => { inputRefs.current[kind] = el; },
              type: 'file',
              accept: SOUND_ACCEPT,
              style: { display: 'none' },
              onChange: (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onUploadSound(kind, file);
              },
            }),
            h('button', {
              type: 'button',
              className: 'pm-btn',
              disabled: !customAvailable || Boolean(busyKind),
              onClick: () => inputRefs.current[kind]?.click(),
            }, busy ? t('saving') : t('soundUpload')),
            h('button', {
              type: 'button',
              className: 'pm-btn',
              disabled: !customAvailable || !hasCustom || Boolean(busyKind),
              onClick: () => onResetSound(kind),
            }, t('restoreDefault')),
            h('button', {
              type: 'button',
              className: 'pm-btn',
              onClick: () => onPreviewSound(kind),
            }, t('soundPreview')),
            h(Switch, {
              checked: events[kind] !== undefined ? Boolean(events[kind]) : defVal,
              onChange: (val) => onEditSound({ events: { ...events, [kind]: val } }),
              label: t(labelKey),
            })));
      }),
      soundCustom?.available === false ? h('div', { className: 'pm-note' }, t('soundUnavailable')) : null);
  }

  function MoraleCard({ moraleVal, onEditMorale, t }) {
    if (!isPlainObject(moraleVal) || !isPlainObject(moraleVal.pack)) return null;
    return h('div', { className: 'pm-card' },
      h('div', { className: 'pm-card__title' }, t('moraleSection')),
      h('div', { className: 'pm-card__hint' }, t('moraleSectionHint')),
      h('div', { className: 'pm-grid-3' },
        MORALE_NUMERIC_FIELDS.map(([key, labelKey, defVal]) => h('div', { className: 'pm-field', key },
          h('span', { className: 'pm-field__label' }, t(labelKey)),
          h('input', {
            type: 'number',
            step: 1,
            value: typeof moraleVal[key] === 'number' ? moraleVal[key] : defVal,
            onChange: (e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onEditMorale(key, Math.trunc(n));
            },
          })))));
  }

  function LanguageCard({
    langOptions, activeLangId, onSelectLang, activePack, onEditMessages,
    hasRotPack, phraseSegments, onEditPhrases, shakeText, onEditShakePhrases, intervalText, onEditInterval,
    thresholdTexts, onEditThreshold,
    hasPromptPack, promptText, onEditPrompt,
    hasMoralePack, moraleTexts, onEditMoraleText,
    t,
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
            onChange: (e) => onSelectLang(e.target.value),
          }, langOptions.map((opt) => h('option', { key: opt.id, value: opt.id },
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
                  onChange: (e) => onEditMessages(activePack, 'sidebar', {
                    'session.new': e.target.value,
                    'session.new.label': e.target.value,
                  }),
                })),
              h('div', { className: 'pm-field' },
                h('span', { className: 'pm-field__label' }, t('key_hero_headline')),
                h('input', {
                  type: 'text',
                  value: activePack.dictionaries?.conversation?.['hero.headline'] || '',
                  onChange: (e) => onEditMessages(activePack, 'conversation', {
                    'hero.headline': e.target.value,
                  }),
                }))) : h('div', { className: 'pm-note' }, t('noLocalePackForLang'))),

          h('div', { className: 'pm-subsection' },
            h('div', { className: 'pm-subsection__title' }, t('phrases')),
            h('div', { className: 'pm-subsection__hint' }, t('phrasesHint')),
            hasRotPack ? h(React.Fragment, null,
              PHRASE_SEGMENTS.map(([segKey, labelKey]) => h('div', { className: 'pm-field', key: segKey },
                h('span', { className: 'pm-field__label' }, t(labelKey)),
                h('textarea', {
                  value: phraseSegments[segKey] || '',
                  onChange: (e) => onEditPhrases(activeLangId, segKey, e.target.value),
                }))),
              h('div', { className: 'pm-field' },
                h('span', { className: 'pm-field__label' }, t('phrasesShake')),
                h('textarea', {
                  value: shakeText,
                  onChange: (e) => onEditShakePhrases(activeLangId, e.target.value),
                })),
              h('div', { className: 'pm-grid-3' },
                h('div', { className: 'pm-field' },
                  h('span', { className: 'pm-field__label' }, t('interval')),
                  h('input', {
                    type: 'number',
                    min: 100,
                    step: 100,
                    value: intervalText,
                    onChange: (e) => onEditInterval(e.target.value),
                  })),
                h('div', { className: 'pm-field' },
                  h('span', { className: 'pm-field__label' }, t('thresholdFirst')),
                  h('input', {
                    type: 'number',
                    min: 1,
                    step: 1,
                    value: thresholdTexts[0],
                    onChange: (e) => onEditThreshold(0, e.target.value),
                  })),
                h('div', { className: 'pm-field' },
                  h('span', { className: 'pm-field__label' }, t('thresholdSecond')),
                  h('input', {
                    type: 'number',
                    min: 2,
                    step: 1,
                    value: thresholdTexts[1],
                    onChange: (e) => onEditThreshold(1, e.target.value),
                  })))) : h('div', { className: 'pm-note' }, t('noLanguages'))),

          h('div', { className: 'pm-subsection' },
            h('div', { className: 'pm-subsection__title' }, t('persona')),
            h('div', { className: 'pm-subsection__hint' }, t('personaHint')),
            hasPromptPack ? h('div', { className: 'pm-field' },
              h('textarea', {
                className: 'pm-prompt-area',
                value: promptText,
                onChange: (e) => onEditPrompt(activeLangId, e.target.value),
              })) : h('div', { className: 'pm-note' }, t('noPrompts'))),

          hasMoralePack ? h('div', { className: 'pm-subsection' },
            h('div', { className: 'pm-subsection__title' }, t('moraleTexts')),
            h('div', { className: 'pm-subsection__hint' }, t('moraleTextsHint')),
            h('div', { className: 'pm-field' },
              h('span', { className: 'pm-field__label' }, t('moraleCommandDesc')),
              h('input', {
                type: 'text',
                value: moraleTexts.commandDescription || '',
                onChange: (e) => onEditMoraleText(activeLangId, 'commandDescription', e.target.value),
              })),
            MORALE_PHRASE_FIELDS.map(([field, labelKey]) => h('div', { className: 'pm-field', key: field },
              h('span', { className: 'pm-field__label' }, t(labelKey)),
              h('textarea', {
                value: moraleTexts[field] || '',
                onChange: (e) => onEditMoraleText(activeLangId, field, e.target.value),
              })))) : null));
  }

  return {
    MasterCard,
    BrandCard,
    IdentityCard,
    SoundCard,
    MoraleCard,
    LanguageCard,
  };
}
