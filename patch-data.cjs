'use strict'

// Shared content loaders for cordis.patch.yml. Keeping directory scanning and
// base64 encoding here avoids repeating path resolution inside every !!js block.

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

function loadPhrases() {
  const out = {}
  for (const { id, fullPath } of readFiles('content/phrases', '.txt')) {
    out[id] = fs.readFileSync(fullPath, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
  }
  return out
}

module.exports = { loadMessages, loadSvgDataUrl, loadPrompts, loadPhrases }
