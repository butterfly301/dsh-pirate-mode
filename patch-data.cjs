'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = __dirname

function readFiles(subdir, ext) {
  const dir = path.join(ROOT, subdir)
  return fs.readdirSync(dir)
    .filter(name => name.endsWith(ext) && name.length > ext.length)
    .sort()
    .map(name => ({
      id: name.slice(0, -ext.length),
      fullPath: path.join(dir, name),
    }))
}

function loadMessages() {
  return readFiles('content/messages', '.json').map(({ id, fullPath }) => {
    const pack = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    return {
      id: pack.id || id,
      label: pack.label || id,
      fallback: pack.fallback || 'en',
      dictionaries: pack.dictionaries || {},
    }
  })
}

function loadSvgDataUrl(relPath) {
  const raw = fs.readFileSync(path.join(ROOT, relPath))
  return 'data:image/svg+xml;base64,' + raw.toString('base64')
}

function loadPrompts() {
  const out = {}
  for (const { id, fullPath } of readFiles('content/prompts', '.txt')) {
    const text = fs.readFileSync(fullPath, 'utf8').trim()
    if (text) out[id] = text
  }
  return out
}

function normalizePhraseList(list) {
  return Array.isArray(list)
    ? list.map(line => String(line ?? '').trim()).filter(Boolean)
    : []
}

function loadPhrases() {
  const out = {}
  for (const { id, fullPath } of readFiles('content/phrases', '.json')) {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    if (Array.isArray(data)) {
      out[id] = { start: [], progress: normalizePhraseList(data), long: [] }
    } else if (data && typeof data === 'object') {
      out[id] = {
        start: normalizePhraseList(data.start),
        progress: normalizePhraseList(data.progress),
        long: normalizePhraseList(data.long),
      }
    }
  }
  return out
}

function loadShakePhrases() {
  const out = {}
  for (const { id, fullPath } of readFiles('content/phrases', '.json')) {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    if (data && typeof data === 'object' && Array.isArray(data.shake)) {
      const list = normalizePhraseList(data.shake)
      if (list.length) out[id] = list
    }
  }
  return out
}

function loadIdentityTemplates() {
  const out = {}
  for (const { id, fullPath } of readFiles('content/identity', '.json')) {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    if (data && typeof data === 'object') {
      out[id] = {
        defaultShipName: String(data.defaultShipName ?? '').trim(),
        heroPrefixTemplate: String(data.heroPrefixTemplate ?? '{shipName}, {headline}'),
        promptShipTemplate: String(data.promptShipTemplate ?? ''),
        promptMateTemplate: String(data.promptMateTemplate ?? ''),
      }
    }
  }
  return out
}

function loadSoundUrls() {
  return {
    completed: '/pirate-mode/sounds/ship-bell.wav',
    failed: '/pirate-mode/sounds/ship-horn.wav',
    waiting: '/pirate-mode/sounds/bosun-pipe.wav',
  }
}

function loadMoralePack() {
  const commandDescription = {}
  const protestPhrases = {}
  const retryPhrases = {}
  const failedPhrases = {}
  const cancelledPhrases = {}
  const rumPhrases = {}

  for (const { id, fullPath } of readFiles('content/morale', '.json')) {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'))
    if (!data || typeof data !== 'object') continue
    if (typeof data.commandDescription === 'string' && data.commandDescription.trim()) {
      commandDescription[id] = data.commandDescription.trim()
    }
    const p = normalizePhraseList(data.protestPhrases)
    const r = normalizePhraseList(data.retryPhrases)
    const f = normalizePhraseList(data.failedPhrases)
    const c = normalizePhraseList(data.cancelledPhrases)
    const u = normalizePhraseList(data.rumPhrases)
    if (p.length) protestPhrases[id] = p
    if (r.length) retryPhrases[id] = r
    if (f.length) failedPhrases[id] = f
    if (c.length) cancelledPhrases[id] = c
    if (u.length) rumPhrases[id] = u
  }

  return {
    commandName: 'rum',
    commandDescription,
    protestPhrases,
    retryPhrases,
    failedPhrases,
    cancelledPhrases,
    rumPhrases,
    confetti: {},
  }
}

module.exports = {
  loadMessages,
  loadSvgDataUrl,
  loadPrompts,
  loadPhrases,
  loadShakePhrases,
  loadIdentityTemplates,
  loadSoundUrls,
  loadMoralePack,
}
