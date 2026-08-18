import pricingData from './usage-pricing.json' with { type: 'json' }

const BOUNDARY_MS = Date.parse(pricingData.boundary)
const PEAK_HOURS = Array.isArray(pricingData.peakHours) ? pricingData.peakHours : []
const PRICING = pricingData.pricing
const STATS_FILE = '.dsh-resource-center-usage-stats.json'
const STATS_PATH = '/api/dsh-resource-center/usage-stats'

if (!Number.isFinite(BOUNDARY_MS) || !PRICING || typeof PRICING !== 'object') throw new Error('usage-pricing.json 无效')

function bucket() {
  return { calls: 0, input: 0, cacheHit: 0, cacheMiss: 0, output: 0, cost: 0 }
}

function sessionBucket() {
  return { ...bucket(), lastAt: 0, title: null }
}

function emptyStats() {
  return {
    version: 1,
    updatedAt: 0,
    meta: { liveSince: 0, lastBackfillAt: 0, lastBackfillSessions: 0, lastBackfillFound: 0, sessionAttribution: false, schemaVersion: 3 },
    total: bucket(),
    byBand: { before: bucket(), afterPeak: bucket(), afterOffPeak: bucket() },
    byModel: { flash: bucket(), pro: bucket(), other: bucket() },
    byModelName: {},
    bySession: {},
    byDay: {},
    byHour: {},
    recent: [],
  }
}

function pad(value) { return value < 10 ? '0' + value : String(value) }

function beijingParts(timestamp) {
  const date = new Date(timestamp + 8 * 3600 * 1000)
  const dateKey = date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate())
  return { hour: date.getUTCHours(), date: dateKey, time: dateKey + ' ' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds()) }
}

function isPeakHour(hour) {
  return PEAK_HOURS.some(range => Array.isArray(range) && range.length === 2 && hour >= Number(range[0]) && hour < Number(range[1]))
}

function bandOf(timestamp) {
  if (timestamp < BOUNDARY_MS) return 'before'
  return isPeakHour(beijingParts(timestamp).hour) ? 'afterPeak' : 'afterOffPeak'
}

function classifyModel(name) {
  if (typeof name !== 'string') return 'other'
  const value = name.toLowerCase()
  if (value.includes('flash')) return 'flash'
  if (value.includes('pro')) return 'pro'
  return 'other'
}

function pickModel(options) {
  if (!options || typeof options !== 'object') return 'unknown'
  for (const value of [options.model, options.config?.model, options.request?.model]) {
    if (typeof value === 'string' && value) return value
  }
  return 'unknown'
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null
  let cacheMiss = 0
  let cacheHit = 0
  let output = 0
  if (typeof usage.inputTokens === 'number') {
    cacheMiss = usage.inputTokens
  } else if (typeof usage.prompt_tokens === 'number') {
    const hit = typeof usage.prompt_cache_hit_tokens === 'number'
      ? usage.prompt_cache_hit_tokens
      : typeof usage.prompt_tokens_details?.cached_tokens === 'number'
        ? usage.prompt_tokens_details.cached_tokens
        : 0
    cacheMiss = Math.max(0, usage.prompt_tokens - hit)
    cacheHit = hit
  }
  if (typeof usage.cacheReadTokens === 'number') cacheHit += usage.cacheReadTokens
  if (typeof usage.cacheWriteTokens === 'number') cacheHit += usage.cacheWriteTokens
  if (typeof usage.outputTokens === 'number') output = usage.outputTokens
  else if (typeof usage.completion_tokens === 'number') output = usage.completion_tokens
  if (cacheMiss <= 0 && cacheHit <= 0 && output <= 0) return null
  return { input: cacheMiss + cacheHit, cacheHit, cacheMiss, output }
}

function extractUsage(chunk) {
  if (!chunk || typeof chunk !== 'object') return null
  const usage = chunk.usage || chunk.delta?.usage || chunk.message_delta?.usage
  return normalizeUsage(usage)
}

function add(target, entry) {
  for (const key of ['calls', 'input', 'cacheHit', 'cacheMiss', 'output', 'cost']) target[key] += Number(entry[key]) || 0
}

function roundCost(value) { return Math.round(value * 1e6) / 1e6 }

function normalizeLoadedStats(value) {
  if (!value || value.version !== 1 || !value.total || !value.byBand || !value.byModel) return null
  const stats = value
  for (const key of ['total', 'byBand.before', 'byBand.afterPeak', 'byBand.afterOffPeak', 'byModel.flash', 'byModel.pro', 'byModel.other']) {
    const [parent, child] = key.split('.')
    if (child) stats[parent][child] = { ...bucket(), ...(stats[parent][child] || {}) }
    else stats[key] = { ...bucket(), ...(stats[key] || {}) }
  }
  if (!stats.meta || typeof stats.meta !== 'object') stats.meta = {}
  if (typeof stats.meta.schemaVersion !== 'number') stats.meta.schemaVersion = 0
  if (typeof stats.meta.sessionAttribution !== 'boolean') stats.meta.sessionAttribution = false
  if (!stats.bySession || typeof stats.bySession !== 'object') stats.bySession = {}
  if (!stats.byModelName || typeof stats.byModelName !== 'object') stats.byModelName = {}
  if (!stats.byDay || typeof stats.byDay !== 'object') stats.byDay = {}
  if (!stats.byHour || typeof stats.byHour !== 'object') stats.byHour = {}
  if (!Array.isArray(stats.recent)) stats.recent = []
  return stats
}

function safeMessage(error) { return String(error?.message || error) }

export function getOwnedSessionEvents(snapshot) {
  const events = Array.isArray(snapshot?.events) ? snapshot.events : []
  const header = snapshot?.header || snapshot?.session || {}
  const seedLength = Number.isSafeInteger(header.seedLength) && header.seedLength >= 0
    ? Math.min(header.seedLength, events.length)
    : 0
  return events.slice(seedLength)
}

export function applyUsageStats(ctx) {
  const webServer = ctx.get('webServer')
  const fs = ctx.get('fs')
  const sandboxPolicy = ctx.get('sandboxPolicy')
  const sessionQuery = ctx.get('sessionQuery')
  const agents = ctx.get('agents')
  if (!webServer) return

  let stats = emptyStats()
  let statsFile = null
  let savePromise = null
  let saveScheduled = false
  const diag = { statsFile: null, writeRoot: null, lastError: '', attempts: [] }
  let fullPolicy = null
  let sessionRoot = null

  try {
    const initiator = agents?.currentInitiator?.()
    const session = initiator?.session
    if (session && sandboxPolicy) {
      fullPolicy = sandboxPolicy.resolve({ session })
      sessionRoot = fullPolicy?.workspaceRoot || null
    }
  } catch (error) {
    diag.lastError = 'policy resolve failed: ' + safeMessage(error)
  }
  if (!fullPolicy && sandboxPolicy) {
    try {
      const resolved = sandboxPolicy.resolve()
      fullPolicy = { mode: 'workspace-write', workspaceRoot: resolved?.workspaceRoot || sandboxPolicy.workspaceRoot }
      sessionRoot = fullPolicy.workspaceRoot || null
    } catch (error) {
      diag.lastError = 'policy fallback failed: ' + safeMessage(error)
    }
  }

  const roots = []
  if (sessionRoot) roots.push(sessionRoot)
  if (sandboxPolicy?.workspaceRoot && sandboxPolicy.workspaceRoot !== sessionRoot) roots.push(sandboxPolicy.workspaceRoot)
  diag.writeRoot = roots[0] || null

  function policyForRoot(root) {
    return { mode: 'workspace-write', workspaceRoot: root, ...(fullPolicy?.sessionId ? { sessionId: fullPolicy.sessionId } : {}) }
  }

  async function loadStats() {
    if (!fs) return
    for (const root of roots) {
      try {
        const target = await fs.resolve(root + '/' + STATS_FILE)
        const loaded = normalizeLoadedStats(JSON.parse(await fs.readText(target)))
        if (!loaded) continue
        stats = loaded
        statsFile = target
        diag.statsFile = target.displayPath || root + '/' + STATS_FILE
        diag.writeRoot = root
        return
      } catch {
        // This root has no readable resource-center statistics yet.
      }
    }
  }

  async function saveTo(root) {
    if (!fs) return { ok: false, root, error: 'fs service unavailable' }
    try {
      const target = await fs.resolve(root + '/' + STATS_FILE)
      await fs.writeText(target, JSON.stringify(stats), undefined, undefined, policyForRoot(root))
      return { ok: true, root, path: target.displayPath || root + '/' + STATS_FILE }
    } catch (error) {
      return { ok: false, root, error: safeMessage(error) }
    }
  }

  async function saveNow() {
    if (savePromise) return savePromise
    savePromise = (async () => {
      const results = []
      for (const root of roots) {
        const result = await saveTo(root)
        results.push(result)
        if (result.ok) {
          statsFile = result.path
          diag.statsFile = result.path
          diag.writeRoot = result.root
          diag.lastError = ''
          break
        }
      }
      diag.attempts = results.slice(-3)
      if (results.length && !results.some(result => result.ok)) diag.lastError = results.map(result => result.root + ': ' + result.error).join(' | ')
      return results
    })()
    try { return await savePromise } finally { savePromise = null }
  }

  function scheduleSave() {
    if (saveScheduled) return
    saveScheduled = true
    ctx.timeout(() => { saveScheduled = false; saveNow() }, 1500)
  }

  function recordUsage(modelName, usage, timestamp, sessionId) {
    const model = classifyModel(modelName)
    const band = bandOf(timestamp)
    const price = PRICING[band]?.[model] || { hit: 0, miss: 0, out: 0 }
    const entry = {
      calls: 1,
      input: usage.input,
      cacheHit: usage.cacheHit,
      cacheMiss: usage.cacheMiss,
      output: usage.output,
      cost: roundCost((usage.cacheHit * price.hit + usage.cacheMiss * price.miss + usage.output * price.out) / 1e6),
    }
    add(stats.total, entry)
    add(stats.byBand[band], entry)
    add(stats.byModel[model], entry)
    const exactModel = typeof modelName === 'string' && modelName.trim() ? modelName.trim() : 'unknown'
    if (!stats.byModelName[exactModel]) stats.byModelName[exactModel] = bucket()
    add(stats.byModelName[exactModel], entry)
    const id = typeof sessionId === 'string' && sessionId ? sessionId : 'unknown'
    if (!stats.bySession[id]) stats.bySession[id] = sessionBucket()
    const session = stats.bySession[id]
    add(session, entry)
    session.lastAt = Math.max(session.lastAt || 0, timestamp)
    const parts = beijingParts(timestamp)
    if (!stats.byDay[parts.date]) stats.byDay[parts.date] = bucket()
    add(stats.byDay[parts.date], entry)
    const hourKey = parts.date + ' ' + pad(parts.hour)
    if (!stats.byHour[hourKey]) stats.byHour[hourKey] = bucket()
    add(stats.byHour[hourKey], entry)
    stats.recent.unshift({ ts: timestamp, time: parts.time, model: modelName, modelKey: model, band, sessionId: id, ...entry })
    if (stats.recent.length > 100) stats.recent.length = 100
    stats.updatedAt = timestamp
    scheduleSave()
  }

  function withTimeout(promise, milliseconds, label) {
    let cancel
    const timeout = new Promise((resolve, reject) => { cancel = ctx.timeout(() => reject(new Error('timeout ' + label)), milliseconds) })
    const result = Promise.race([promise, timeout])
    result.then(() => cancel?.(), () => cancel?.())
    return result
  }

  async function backfillStats() {
    if (!sessionQuery?.listSessions || !sessionQuery?.readSession) return { ok: false, error: 'session query service unavailable' }
    let records
    try { records = await withTimeout(sessionQuery.listSessions(), 60000, 'listSessions') } catch (error) { return { ok: false, error: 'listSessions 失败：' + safeMessage(error) } }
    let sessions = 0
    let found = 0
    let failed = 0
    for (const record of records || []) {
      const id = typeof record?.header?.id === 'string' ? record.header.id : null
      if (!id) continue
      let snapshot
      try { snapshot = await withTimeout(sessionQuery.readSession(id), 20000, 'readSession') } catch { failed++; continue }
      sessions++
      let model = 'unknown'
      for (const event of getOwnedSessionEvents(snapshot)) {
        if (event?.type === 'request/header') {
          const value = event.data?.header?.config?.model
          if (typeof value === 'string' && value) model = value
        }
        if (event?.type !== 'assistant/message') continue
        const usage = normalizeUsage(event.data?.usage)
        if (!usage) continue
        found++
        recordUsage(model, usage, typeof event.time === 'number' ? event.time : Date.now(), id)
      }
      try {
        const title = await withTimeout(sessionQuery.readTitle?.(id), 10000, 'readTitle')
        if (title?.title && stats.bySession[id]) stats.bySession[id].title = title.title
      } catch {
        // Titles are optional and do not affect usage totals.
      }
    }
    stats.recent.sort((a, b) => b.ts - a.ts)
    stats.meta.lastBackfillAt = Date.now()
    stats.meta.lastBackfillSessions = sessions
    stats.meta.lastBackfillFound = found
    stats.meta.sessionAttribution = true
    stats.meta.schemaVersion = 3
    await saveNow()
    return { ok: true, sessions, found, failed }
  }

  if (typeof ctx.on === 'function') ctx.on('llm/stream', (options, next) => {
    const model = pickModel(options)
    const stream = next()
    const accumulated = { input: 0, cacheHit: 0, cacheMiss: 0, output: 0, seen: false }
    return (async function* () {
      try {
        for await (const chunk of stream) {
          const usage = extractUsage(chunk)
          if (usage) {
            accumulated.seen = true
            for (const key of ['input', 'cacheHit', 'cacheMiss', 'output']) accumulated[key] = Math.max(accumulated[key], usage[key])
          }
          yield chunk
        }
      } finally {
        if (accumulated.seen && (accumulated.input > 0 || accumulated.output > 0)) {
          let sessionId
          try { sessionId = agents?.currentInitiator?.()?.session?.id } catch { sessionId = undefined }
          recordUsage(model, accumulated, Date.now(), sessionId)
        }
      }
    })()
  })

  ctx.effect(() => () => { void saveNow() }, 'dsh-resource-center: usage final persistence')
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: STATS_PATH,
    handler: async (req, res) => {
      try {
        if (req.method === 'POST') {
          const action = new URL(req.url, 'http://localhost').searchParams.get('action')
          if (action === 'backfill') {
        stats = emptyStats()
            stats.meta.liveSince = Date.now()
            return jsonResponse(res, 200, await backfillStats())
          }
          if (action === 'clear') {
            stats = emptyStats()
            stats.meta.liveSince = Date.now()
            await saveNow()
            return jsonResponse(res, 200, { ok: true })
          }
        }
        const query = new URL(req.url, 'http://localhost').searchParams
        const requestedSessionId = String(query.get('sessionId') || '').trim()
        const currentSession = requestedSessionId
          ? {
              id: requestedSessionId,
              usage: { ...sessionBucket(), ...(stats.bySession[requestedSessionId] || {}) },
            }
          : null
        return jsonResponse(res, 200, {
          ok: true,
          source: 'dsh-resource-center',
          stats,
          currentSession,
          pricing: PRICING,
          boundaryText: String(pricingData.boundary).replace('T', ' ').replace(/[+].*$/, '') + '（北京时间）',
          peakHoursText: '高峰 ' + PEAK_HOURS.map(range => range[0] + ':00–' + range[1] + ':00').join('、') + '（北京时间）',
          saved: Boolean(statsFile),
          diag,
        })
      } catch (error) {
        return jsonResponse(res, 500, { ok: false, error: safeMessage(error) })
      }
    },
  }), 'dsh-resource-center: usage stats route')

  loadStats().then(() => {
    if (stats.total.calls === 0 || stats.meta.sessionAttribution !== true || stats.meta.schemaVersion !== 3) {
      stats = emptyStats()
      stats.meta.liveSince = Date.now()
      backfillStats().catch(error => { diag.lastError = 'auto-backfill failed: ' + safeMessage(error) })
    }
  }).catch(error => { diag.lastError = 'load failed: ' + safeMessage(error) })
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export const usageStatsPath = STATS_PATH
