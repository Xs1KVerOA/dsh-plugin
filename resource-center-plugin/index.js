import { apply as applyServiceManager } from './service-manager-host.js'
import { applyWebTesting, TestConfig } from './test-host.js'
import { applyUsageStats } from './usage-stats-host.js'
import { apply as applyRightSidebar, inject as rightSidebarInject } from './right-sidebar-host.js'
import { applyHunter } from './hunter-host.js'

export const name = 'dsh-resource-center'

// Host routes persist session titles and serialize bounded session references.
// All list data and workspace grouping still come from the native DSH client stores.
export const inject = [...new Set([
  'webServer', 'sessions', 'llm', 'credentials', 'fs', 'tools', 'sandboxPolicy', 'dshAuth', 'sessionQuery', 'timer',
  ...rightSidebarInject,
])]
export const Config = TestConfig

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

function contentSnippet(text, query, normalizedQuery = query.toLocaleLowerCase()) {
  const position = text.toLocaleLowerCase().indexOf(normalizedQuery)
  if (position < 0) return undefined
  const start = Math.max(0, position - 42)
  const end = Math.min(text.length, position + query.length + 90)
  return text.slice(start, end).replace(/\s+/g, ' ').trim()
}

function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
}

function xmlCdata(value) {
  return `<![CDATA[${String(value ?? '').replaceAll(']]>', ']]]]><![CDATA[>')}]]>`
}

function sessionReferenceMarkup(session) {
  const title = session?.displayTitle || session?.title || session?.id || '未命名会话'
  const content = sessionText(session?.events || []).parts.join('\n').slice(0, 120000)
  return `<dsh-session-ref id="${xmlEscape(session.id)}" title="${xmlEscape(title)}">\n${xmlCdata(content)}\n</dsh-session-ref>`
}

export function apply(ctx, config = {}) {
  const webServer = ctx.get('webServer')
  const sessions = ctx.get('sessions')
  const sessionTitle = ctx.get('sessionTitle')
  if (!webServer) return
  const sessionSearchCache = new Map()
  const searchableText = session => {
    if (!session) return ''
    const events = session?.events || []
    const cached = sessionSearchCache.get(session?.id)
    const lastEvent = Array.isArray(events) ? events[events.length - 1] : undefined
    if (cached && cached.events === events && cached.length === events.length && cached.lastEvent === lastEvent) return cached.text
    const text = sessionText(events).parts.join('\n')
    sessionSearchCache.set(session.id, { events, length: events.length, lastEvent, text })
    if (sessionSearchCache.size > 512) sessionSearchCache.delete(sessionSearchCache.keys().next().value)
    return text
  }

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
        const normalizedQuery = query.toLocaleLowerCase()
        for (const id of ids) {
          const session = sessions && typeof sessions.get === 'function' ? sessions.get(id) : undefined
          const snippet = contentSnippet(searchableText(session), query, normalizedQuery)
          if (snippet) matches.push({ id, snippet })
        }
        return json(res, 200, { ok: true, matches })
      } catch (error) {
        return json(res, 400, { ok: false, error: error?.message || String(error) })
      }
    },
  }), 'dsh-resource-center: content search route')

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/api/dsh-resource-center/session-reference',
    handler: async (req, res) => {
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
      try {
        const body = await readJson(req)
        const id = String(body?.id || '').trim()
        if (!id) return json(res, 400, { ok: false, error: 'id 不能为空' })
        const session = sessions && typeof sessions.get === 'function' ? sessions.get(id) : undefined
        if (!session) return json(res, 404, { ok: false, error: '会话不存在' })
        return json(res, 200, { ok: true, markup: sessionReferenceMarkup(session) })
      } catch (error) {
        return json(res, 400, { ok: false, error: error?.message || String(error) })
      }
    },
  }), 'dsh-resource-center: session reference route')

  applyServiceManager(ctx)
  applyWebTesting(ctx, config)
  applyUsageStats(ctx)
  applyHunter(ctx)
  // The right workbench is part of the resource center now. Its routes use a
  // namespaced prefix owned entirely by this plugin.
  applyRightSidebar(ctx, {})
}
