// Host entry for dsh-pirate-mode. Serves read-only UI dictionaries from
// locale/*.json under /pirate-mode/locale/<lang>.json so client.js loads only
// the active language at runtime without embedding every translation table.

import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'pirate-mode'

const ROUTE = '/pirate-mode/locale'
const PREFIX = `${ROUTE}/`
const LOCALE_ROOT = resolve(fileURLToPath(new URL('./locale/', import.meta.url)))
const LANG_RE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u

function send(req, res, status, body, contentType) {
  const buf = body ? Buffer.from(body) : undefined
  const headers = { 'x-content-type-options': 'nosniff' }
  if (contentType) headers['content-type'] = contentType
  if (buf) headers['content-length'] = String(buf.byteLength)
  if (status === 200) headers['cache-control'] = 'public, max-age=3600'
  res.writeHead(status, headers)
  res.end(req.method === 'HEAD' ? undefined : buf)
}

async function readLocaleUi(lang) {
  const candidates = []
  const lower = lang.toLowerCase()
  const primary = lower.split('-')[0]
  candidates.push(lower)
  if (primary && primary !== lower) candidates.push(primary)
  if (!candidates.includes('en')) candidates.push('en')

  for (const id of candidates) {
    try {
      const raw = await readFile(join(LOCALE_ROOT, `${id}.json`), 'utf8')
      const data = JSON.parse(raw)
      if (data && typeof data.ui === 'object' && data.ui) {
        return { lang: id, ui: data.ui }
      }
    } catch {}
  }
  return null
}

export function apply(ctx) {
  ctx.inject(['webServer'], scope => scope.effect(() => {
    return scope.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(req, res, 405)
        let url
        try {
          url = new URL(req.url ?? ROUTE, 'http://dsh.local')
        } catch {
          return send(req, res, 400)
        }
        if (!url.pathname.startsWith(PREFIX) || !url.pathname.endsWith('.json')) {
          return send(req, res, 404)
        }
        const rawLang = url.pathname.slice(PREFIX.length, -5)
        let lang
        try {
          lang = decodeURIComponent(rawLang)
        } catch {
          return send(req, res, 400)
        }
        if (!LANG_RE.test(lang)) return send(req, res, 400)
        const payload = await readLocaleUi(lang)
        if (!payload) return send(req, res, 404)
        return send(req, res, 200, JSON.stringify(payload), 'application/json; charset=utf-8')
      },
    })
  }, 'dsh-pirate-mode: locale route'))
}
