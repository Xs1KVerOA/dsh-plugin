import { apply as applyServiceManager } from './service-manager-host.js'

export const name = 'dsh-resource-center'

// The host route is only used for session-title persistence. All list data and
// workspace grouping still come from the native DSH client stores.
export const inject = ['webServer', 'sessions', 'credentials', 'fs', 'tools']

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    const value = Buffer.from(chunk)
    total += value.length
    if (total > 1024 * 1024) throw new Error('request body too large')
    chunks.push(value)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text.trim() ? JSON.parse(text) : {}
}

function sessionText(value, state = { size: 0, parts: [] }) {
  if (state.size >= 300000 || value == null) return state
  if (typeof value === 'string') {
    const remaining = 300000 - state.size
    const part = value.slice(0, remaining)
    state.parts.push(part)
    state.size += part.length
    return state
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      sessionText(item, state)
      if (state.size >= 300000) break
    }
    return state
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) {
      sessionText(item, state)
      if (state.size >= 300000) break
    }
  }
  return state
}

function contentSnippet(events, query) {
  const text = sessionText(events).parts.join('\n')
  const position = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase())
  if (position < 0) return undefined
  const start = Math.max(0, position - 42)
  const end = Math.min(text.length, position + query.length + 90)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  const sessions = ctx.get('sessions')
  const sessionTitle = ctx.get('sessionTitle')
  if (!webServer) return

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dsh-resource-center/rename-session',
    handler: async (req, res) => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
      try {
        const body = await readJson(req)
        const id = String(body?.id || '').trim()
        const title = String(body?.title || '').trim()
        if (!id || !title) return json(res, 400, { ok: false, error: 'id 和 title 不能为空' })
        if (!sessions || !sessionTitle) return json(res, 503, { ok: false, error: 'session title service unavailable' })
        const session = sessions.get(id)
        if (!session) return json(res, 404, { ok: false, error: 'session not found' })
        sessionTitle.rename(session, title)
        return json(res, 200, { ok: true })
      } catch (error) {
        return json(res, 400, { ok: false, error: error?.message || String(error) })
      }
    },
  }), 'dsh-resource-center: rename route')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dsh-resource-center/search-sessions',
    handler: async (req, res) => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
      try {
        const body = await readJson(req)
        const query = String(body?.query || '').trim().slice(0, 200)
        const ids = Array.isArray(body?.ids)
          ? [...new Set(body.ids.map(value => String(value || '').trim()).filter(Boolean))].slice(0, 500)
          : []
        if (!query || !ids.length) return json(res, 200, { ok: true, matches: [] })
        const matches = []
        for (const id of ids) {
          const session = sessions && typeof sessions.get === 'function' ? sessions.get(id) : undefined
          const snippet = contentSnippet(session?.events || [], query)
          if (snippet) matches.push({ id, snippet })
        }
        return json(res, 200, { ok: true, matches })
      } catch (error) {
        return json(res, 400, { ok: false, error: error?.message || String(error) })
      }
    },
  }), 'dsh-resource-center: content search route')

  applyServiceManager(ctx)
}
