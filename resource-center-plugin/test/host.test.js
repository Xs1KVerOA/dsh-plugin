import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { createServer as createHttpsServer } from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply } from '../index.js'
import { applyUsageStats, getOwnedSessionEvents, usageStatsPath } from '../usage-stats-host.js'
import { parseSshInspectOutput } from '../service-manager-host.js'
import { isPrivateAddress, isPrivateTarget, makeRuntime, normalizeConfig, normalizeNetwork, resolveTargetAddresses } from '../test-host.js'

async function callRuntimeApi(runtime, method, url, value) {
  let status
  let raw = ''
  const request = {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      if (value !== undefined) yield Buffer.from(JSON.stringify(value))
    },
  }
  await runtime.apiHandler(request, {
    writeHead(code) { status = code },
    end(body) { raw = String(body || '') },
  })
  return { status, body: raw ? JSON.parse(raw) : undefined }
}

async function waitFor(check, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = check()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error('等待测试状态超时')
}

test('MITM only binds to loopback and recognizes private IPv4/IPv6 forms', () => {
  assert.equal(normalizeConfig().listenHost, '127.0.0.1')
  assert.throws(() => normalizeConfig({ listenHost: '0.0.0.0' }), /只允许 loopback/)
  assert.throws(() => normalizeConfig({ listenHost: '192.168.1.10' }), /只允许 loopback/)
  assert.equal(isPrivateTarget('http://127.0.0.1/'), true)
  assert.equal(isPrivateTarget('http://[::1]/'), true)
  assert.equal(isPrivateTarget('http://[fc00::1]/'), true)
  assert.equal(isPrivateAddress('::ffff:127.0.0.1'), true)
  assert.equal(isPrivateAddress('fe80::1'), true)
  assert.equal(isPrivateAddress('2001:db8::1'), false)
})

test('SSH inspect output is normalized into a compact server snapshot', () => {
  const snapshot = parseSshInspectOutput([
    '__DSH_HOST__\tapp-01',
    '__DSH_OS__\tUbuntu 24.04 LTS',
    '__DSH_KERNEL__\tLinux 6.8.0 x86_64 GNU/Linux',
    '__DSH_UPTIME__\tup 3 days',
    '__DSH_CPU_CORES__\t8',
    '__DSH_CPU_LOAD__\t0.12 0.18 0.20',
    '__DSH_MEMORY__\t17179869184\t4294967296\t12884901888',
    '__DSH_DISK__\t107374182400\t21474836480\t20%',
    '__DSH_PORT__\t22',
    '__DSH_PORT__\t8080',
    '__DSH_PORT__\t22',
  ].join('\n'))
  assert.equal(snapshot.host, 'app-01')
  assert.equal(snapshot.cpu.cores, 8)
  assert.equal(snapshot.memory.usedBytes, 4294967296)
  assert.deepEqual(snapshot.ports, ['22', '8080'])
})

test('combined Host plugin keeps workspace routes and service-management Tool', () => {
  const routes = []
  const upgrades = []
  const tools = []
  const guards = []
  const effects = []
  const toolService = {
    register(tool) { tools.push(tool) },
    guard(guard) { guards.push(guard) },
  }
  const webServer = {
    register(route) { routes.push(route); return () => {} },
    registerUpgrade(route) { upgrades.push(route); return () => {} },
  }
  const ctx = {
    webServer,
    webRuntime: { trustedHosts: [] },
    sessions: { get() { return undefined } },
    tools: toolService,
    get(name) {
      if (name === 'webServer') return webServer
      if (name === 'sessions') return { get() { return undefined } }
      if (name === 'sessionTitle') return undefined
      if (name === 'credentials') return {}
      if (name === 'fs') return {}
      if (name === 'tools') return toolService
      if (name === 'sandboxPolicy') return { workspaceRoot: '/tmp' }
      return undefined
    },
    effect(factory) { effects.push(factory()) },
    inject(_names, callback) {
      callback({ settings: {
        register() { return { get() { return {} }, watch() {} } },
        describe() { return [] },
        update() {},
      } })
    },
  }
  apply(ctx)
  assert.deepEqual(routes.map(route => route.path), [
    '/api/dsh-resource-center/rename-session',
    '/api/dsh-resource-center/search-sessions',
    '/api/dsh-resource-center/session-reference',
    '/api/dsh-service-manage',
    '/api/dsh-web-testing',
    '/api/dsh-resource-center/usage-stats',
    '/dsh-resource-center/sidebar/api',
    '/dsh-resource-center/sidebar/bundle',
    '/dsh-resource-center/sidebar/file',
    '/dsh-resource-center/sidebar/html',
  ])
  assert.deepEqual(tools.map(tool => tool.name), ['dsh_server_manage', 'dsh_web_fuzzer', 'dsh_mitm_capture'])
  assert.equal(guards.length, 1)
  assert.match(String(guards[0]({ name: 'bash', arguments: { command: 'ssh user@example.com' } })), /dsh_server_manage/)
  assert.equal(guards[0]({ name: 'bash', arguments: { command: 'pwd' } }), undefined)
  assert.equal(upgrades.length, 2)
  assert.equal(effects.length, 16)
})

test('resource center owns an independent usage-stats route and records model/session tokens', async () => {
  const routes = []
  let streamHook
  const saved = []
  const fs = {
    async resolve() { return { displayPath: '/tmp/.dsh-resource-center-usage-stats.json' } },
    async readText() { throw new Error('not found') },
    async writeText(_target, text) { saved.push(JSON.parse(text)) },
  }
  const ctx = {
    get(name) {
      if (name === 'webServer') return { register(route) { routes.push(route); return () => {} } }
      if (name === 'fs') return fs
      if (name === 'sandboxPolicy') return { workspaceRoot: '/tmp', resolve() { return { workspaceRoot: '/tmp' } } }
      if (name === 'sessionQuery') return { async listSessions() { return [] }, async readSession() { return { events: [] } } }
      if (name === 'agents') return { currentInitiator() { return { session: { id: 'current-session' } } } }
      return undefined
    },
    effect(factory) { factory() },
    on(name, handler) { if (name === 'llm/stream') streamHook = handler },
    timeout(callback, milliseconds) {
      const timer = setTimeout(callback, milliseconds)
      timer.unref?.()
      return () => clearTimeout(timer)
    },
  }
  applyUsageStats(ctx)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(routes.filter(route => route.path === usageStatsPath).length, 1)
  assert.equal(typeof streamHook, 'function')
  const stream = streamHook({ model: 'deepseek-v4-flash' }, () => (async function* () {
    yield { usage: { prompt_tokens: 100, prompt_cache_hit_tokens: 20, completion_tokens: 30 } }
  })())
  for await (const _chunk of stream) {}
  const route = routes.find(item => item.path === usageStatsPath)
  let body
  await route.handler({ method: 'GET', url: usageStatsPath }, {
    writeHead() {},
    end(value) { body = JSON.parse(value) },
  })
  assert.equal(body.ok, true)
  assert.equal(body.source, 'dsh-resource-center')
  assert.equal(body.stats.total.calls, 1)
  assert.equal(body.stats.total.input, 100)
  assert.equal(body.stats.total.cacheHit, 20)
  assert.equal(body.stats.total.cacheMiss, 80)
  assert.equal(body.stats.total.output, 30)
  assert.equal(body.stats.byModel.flash.calls, 1)
  assert.equal(body.stats.byModelName['deepseek-v4-flash'].calls, 1)
  assert.equal(body.stats.bySession['current-session'].output, 30)
  let currentBody
  await route.handler({ method: 'GET', url: `${usageStatsPath}?sessionId=current-session` }, {
    writeHead() {},
    end(value) { currentBody = JSON.parse(value) },
  })
  assert.equal(currentBody.currentSession.id, 'current-session')
  assert.equal(currentBody.currentSession.usage.cost, body.stats.bySession['current-session'].cost)
  assert.ok(saved.length >= 1)
})

test('usage stats migrates legacy files without discarding counters', async () => {
  const routes = []
  const saved = []
  const bucket = () => ({ calls: 2, input: 10, cacheHit: 1, cacheMiss: 9, output: 20, cost: 0.1 })
  const fs = {
    async resolve() { return { displayPath: '/tmp/.dsh-resource-center-usage-stats.json' } },
    async readText() {
      return JSON.stringify({
        total: bucket(),
        byBand: { before: bucket(), afterPeak: bucket(), afterOffPeak: bucket() },
        byModel: { flash: bucket(), pro: bucket(), other: bucket() },
        updatedAt: 123,
      })
    },
    async writeText(_target, text) { saved.push(JSON.parse(text)) },
  }
  const ctx = {
    get(name) {
      if (name === 'webServer') return { register(route) { routes.push(route); return () => {} } }
      if (name === 'fs') return fs
      if (name === 'sandboxPolicy') return { workspaceRoot: '/tmp', resolve() { return { workspaceRoot: '/tmp' } } }
      return undefined
    },
    effect(factory) { factory() },
    timeout(callback, milliseconds) {
      const timer = setTimeout(callback, milliseconds)
      timer.unref?.()
      return () => clearTimeout(timer)
    },
  }
  applyUsageStats(ctx)
  await new Promise(resolve => setImmediate(resolve))
  const route = routes.find(item => item.path === usageStatsPath)
  let body
  await route.handler({ method: 'GET', url: usageStatsPath }, {
    writeHead() {},
    end(value) { body = JSON.parse(value) },
  })
  assert.equal(body.stats.version, 1)
  assert.equal(body.stats.total.calls, 2)
  assert.equal(body.stats.meta.schemaVersion, 3)
  assert.equal(body.stats.meta.sessionAttribution, false)
  assert.ok(saved.length >= 1)
})

test('usage backfill shares one promise and can be cancelled', async () => {
  const routes = []
  const fs = {
    async resolve() { return { displayPath: '/tmp/.dsh-resource-center-usage-stats.json' } },
    async readText() {
      return JSON.stringify({
        version: 1,
        total: { calls: 1, input: 1, cacheHit: 0, cacheMiss: 1, output: 1, cost: 0 },
        byBand: { before: {}, afterPeak: {}, afterOffPeak: {} },
        byModel: { flash: {}, pro: {}, other: {} },
        meta: { schemaVersion: 3, sessionAttribution: true },
      })
    },
    async writeText() {},
  }
  const ctx = {
    get(name) {
      if (name === 'webServer') return { register(route) { routes.push(route); return () => {} } }
      if (name === 'fs') return fs
      if (name === 'sandboxPolicy') return { workspaceRoot: '/tmp', resolve() { return { workspaceRoot: '/tmp' } } }
      if (name === 'sessionQuery') return { async listSessions() { return [{ header: { id: 'slow-session' } }] }, async readSession() { await new Promise(() => {}) } }
      return undefined
    },
    effect(factory) { factory() },
    timeout(callback, milliseconds) {
      const timer = setTimeout(callback, milliseconds)
      timer.unref?.()
      return () => clearTimeout(timer)
    },
  }
  applyUsageStats(ctx)
  await new Promise(resolve => setImmediate(resolve))
  const route = routes.find(item => item.path === usageStatsPath)
  let firstBody
  let secondBody
  const first = route.handler({ method: 'POST', url: `${usageStatsPath}?action=backfill` }, { writeHead() {}, end(value) { firstBody = JSON.parse(value) } })
  const second = route.handler({ method: 'POST', url: `${usageStatsPath}?action=backfill` }, { writeHead() {}, end(value) { secondBody = JSON.parse(value) } })
  await new Promise(resolve => setImmediate(resolve))
  let running
  await route.handler({ method: 'GET', url: usageStatsPath }, { writeHead() {}, end(value) { running = JSON.parse(value) } })
  assert.equal(running.backfill.status, 'running')
  let cleared
  await route.handler({ method: 'POST', url: `${usageStatsPath}?action=clear` }, { writeHead() {}, end(value) { cleared = JSON.parse(value) } })
  await Promise.all([first, second])
  const firstResult = firstBody
  const secondResult = secondBody
  assert.equal(firstResult.ok, false)
  assert.equal(secondResult.ok, false)
  assert.equal(firstResult.cancelled, true)
  assert.equal(secondResult.cancelled, true)
  assert.equal(cleared.ok, true)
})

test('usage backfill excludes inherited fork seed events', () => {
  const inherited = { type: 'assistant/message', data: { usage: { inputTokens: 10 } } }
  const owned = { type: 'assistant/message', data: { usage: { inputTokens: 20 } } }
  const snapshot = { session: { seedLength: 1 }, events: [inherited, owned] }
  assert.deepEqual(getOwnedSessionEvents(snapshot), [owned])
  assert.deepEqual(getOwnedSessionEvents({ session: { seedLength: 100 }, events: [inherited] }), [])
  assert.deepEqual(getOwnedSessionEvents({ header: { seedLength: 1 }, session: { seedLength: 0 }, events: [inherited, owned] }), [owned])
})

test('service catalog exposes only allowlisted options and uses collision-free credential refs', async () => {
  const routes = []
  const config = {
    connections: [{
      id: 'a-b', name: 'Mongo', type: 'mongodb', host: 'db.example.com', port: 27017,
      username: 'app', database: '', authMode: 'password',
      options: { connectionString: 'mongodb://app:secret@db.example.com', cert: 'PRIVATE CERT', key: 'PRIVATE KEY', ssl: true, proxy: { type: 'none' } },
    }],
  }
  const fs = {
    async resolve() { return '/tmp/.dsh-servers.json' },
    async stat() { return { size: 1 } },
    async readText() { return JSON.stringify(config) },
    async writeText() {},
  }
  const credentialRefs = []
  const credentials = { async resolve(ref) { credentialRefs.push(ref); return undefined } }
  const toolService = { register() {}, guard() {} }
  const ctx = {
    tools: toolService,
    get(name) {
      if (name === 'webServer') return { register(route) { routes.push(route); return () => {} } }
      if (name === 'sessions') return { get() { return undefined } }
      if (name === 'sessionTitle') return undefined
      if (name === 'credentials') return credentials
      if (name === 'fs') return fs
      if (name === 'tools') return toolService
      if (name === 'sandboxPolicy') return { workspaceRoot: '/tmp' }
      return undefined
    },
    effect(factory) { factory() },
  }
  apply(ctx)
  const route = routes.find(item => item.path === '/api/dsh-service-manage')
  let responseBody
  await route.handler({ method: 'POST', socket: { remoteAddress: '127.0.0.1' }, async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify({ op: 'list' })) } }, {
    writeHead() {},
    end(value) { responseBody = JSON.parse(value) },
  })
  const connection = responseBody.connections[0]
  assert.equal(connection.options.connectionString, undefined)
  assert.equal(connection.options.cert, undefined)
  assert.equal(connection.options.key, undefined)
  assert.equal(connection.options.ssl, true)
  assert.equal(connection.secrets.password, false)
  assert.ok(credentialRefs.length > 0)
  assert.ok(credentialRefs.every(ref => /^DSH_SERVER_V2_[0-9a-f]{64}_/.test(ref)))
})

test('session references serialize readable bounded conversation context', async () => {
  const routes = []
  const session = { id: 'session-1', displayTitle: '架构分析', events: ['用户问题', { text: '助手回答' }] }
  const toolService = { register() {}, guard() {} }
  const ctx = {
    tools: toolService,
    get(name) {
      if (name === 'webServer') return { register(route) { routes.push(route); return () => {} } }
      if (name === 'sessions') return { get(id) { return id === session.id ? session : undefined } }
      if (name === 'sessionTitle') return undefined
      if (name === 'credentials') return {}
      if (name === 'fs') return {}
      if (name === 'tools') return toolService
      return undefined
    },
    effect(factory) { factory() },
  }
  apply(ctx)
  const route = routes.find(item => item.path === '/api/dsh-resource-center/session-reference')
  assert.ok(route)
  const result = await callRuntimeApi({ apiHandler: route.handler }, 'POST', '/', { id: session.id })
  assert.equal(result.status, 200)
  assert.match(result.body.markup, /<dsh-session-ref id="session-1" title="架构分析">/)
  assert.match(result.body.markup, /用户问题/)
  assert.match(result.body.markup, /助手回答/)
  assert.match(result.body.markup, /<!\[CDATA\[/)
})

test('SSH host exposes SFTP file-management operations', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../service-manager-host.js', import.meta.url), 'utf8')
  for (const operation of ['listFiles', 'readFile', 'writeFile', 'downloadFile', 'uploadFile', 'mkdir', 'createFile', 'deleteFile']) {
    assert.match(source, new RegExp(`params\\.op === '${operation}'`), `missing SSH operation: ${operation}`)
  }
  assert.match(source, /params\.op === 'renameFile'/, 'SSH should keep the path boundary for rename support')
  assert.match(source, /SSH_SFTP_CACHE_TTL = 30_000/, 'SSH SFTP sessions should have a bounded reuse window')
  assert.match(source, /getCachedSshSftpSession/, 'SSH SFTP operations should reuse one connection')
  assert.match(source, /if \(params\.op === 'inspect'\)/, 'SSH inspect should use the same cleanup path as other operations')
})

test('resource center carries the Web Testing status API', async () => {
  const runtime = makeRuntime(normalizeConfig())
  let status
  let body
  await runtime.apiHandler(
    { method: 'GET', url: '/api/dsh-web-testing/status' },
    {
      writeHead(code) { status = code },
      end(value) { body = JSON.parse(value) },
    },
  )
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.proxy, null)
  assert.equal(body.config.listenHost, '127.0.0.1')
})

test('browser route shares MITM config and records browser traffic', async () => {
  const upstream = createServer((_req, res) => {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "frame-ancestors 'none'",
      'x-frame-options': 'DENY',
    })
    res.end('<html><body>browser-route-ok</body></html>')
  })
  await new Promise((resolve, reject) => {
    upstream.once('error', reject)
    upstream.listen({ host: '127.0.0.1', port: 0 }, resolve)
  })
  const address = upstream.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const runtime = makeRuntime(normalizeConfig())
  runtime.state.mitm.mode = 'manual'
  runtime.state.mitm.holdResponse = false
  let status
  let raw
  let responseHeaders
  try {
    const browserRequest = runtime.apiHandler({
      method: 'GET',
      url: `/api/dsh-web-testing/browser?url=${encodeURIComponent(`http://127.0.0.1:${port}/`)}`,
      headers: { host: '127.0.0.1' },
      async *[Symbol.asyncIterator]() {},
    }, {
      writeHead(code, headers) { status = code; responseHeaders = headers },
      end(value) { raw = Buffer.isBuffer(value) ? value.toString('utf8') : String(value || '') },
    })
    await waitFor(() => runtime.state.flows[0]?.metadata.pendingStage === 'request')
    await callRuntimeApi(runtime, 'POST', `/api/dsh-web-testing/flow/${runtime.state.flows[0].id}/action`, { action: 'release-request' })
    await browserRequest
    assert.equal(status, 200)
    assert.match(raw, /browser-route-ok/)
    const headerNames = Object.keys(responseHeaders || {}).map(name => name.toLowerCase())
    assert.equal(headerNames.includes('x-frame-options'), false)
    assert.equal(headerNames.includes('content-security-policy'), false)
    assert.equal(runtime.state.flows.length, 1)
    assert.equal(runtime.state.flows[0].source, 'browser')
    assert.equal(runtime.state.flows[0].metadata.pendingStage, undefined)
  } finally {
    await new Promise(resolve => upstream.close(resolve))
  }
})

test('MITM flow list serializes pending interceptions as lossless JSON', async () => {
  const runtime = makeRuntime(normalizeConfig())
  runtime.state.mitm.mode = 'manual'
  runtime.state.mitm.holdResponse = false
  const upstream = createServer((_req, res) => res.end('pending-json'))
  await new Promise((resolve, reject) => {
    upstream.once('error', reject)
    upstream.listen({ host: '127.0.0.1', port: 0 }, resolve)
  })
  const address = upstream.address()
  const port = typeof address === 'object' && address ? address.port : 0
  let browserRequest
  try {
    browserRequest = runtime.apiHandler({
      method: 'GET',
      url: `/api/dsh-web-testing/browser?url=${encodeURIComponent(`http://127.0.0.1:${port}/pending`)}`,
      headers: { host: '127.0.0.1' },
      async *[Symbol.asyncIterator]() {},
    }, { writeHead() {}, end() {} })
    const flow = await waitFor(() => runtime.state.flows[0]?.metadata.pendingStage === 'request' && runtime.state.flows[0])
    const list = await callRuntimeApi(runtime, 'GET', '/api/dsh-web-testing/flows')
    assert.equal(list.status, 200)
    assert.equal(list.body.flows[0].id, flow.id)
    assert.equal(list.body.flows[0].status, null)
    assert.equal(list.body.flows[0].durationMs, null)
    assert.equal(list.body.flows[0].error, null)
    await callRuntimeApi(runtime, 'POST', `/api/dsh-web-testing/flow/${encodeURIComponent(flow.id)}/action`, { action: 'release-request' })
    await browserRequest
  } finally {
    await new Promise(resolve => upstream.close(resolve))
  }
})

test('MITM configuration changes release already-pending requests in real time', async () => {
  const upstream = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('live-config-ok')
  })
  await new Promise((resolve, reject) => {
    upstream.once('error', reject)
    upstream.listen({ host: '127.0.0.1', port: 0 }, resolve)
  })
  const address = upstream.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const runtime = makeRuntime(normalizeConfig())
  runtime.state.mitm.mode = 'manual'
  runtime.state.mitm.holdResponse = false
  let status
  let raw
  try {
    const browserRequest = runtime.apiHandler({
      method: 'GET',
      url: `/api/dsh-web-testing/browser?url=${encodeURIComponent(`http://127.0.0.1:${port}/live-config`)}`,
      headers: { host: '127.0.0.1' },
      async *[Symbol.asyncIterator]() {},
    }, {
      writeHead(code) { status = code },
      end(value) { raw = Buffer.isBuffer(value) ? value.toString('utf8') : String(value || '') },
    })

    await waitFor(() => runtime.state.flows[0]?.metadata.pendingStage === 'request')
    const update = await callRuntimeApi(runtime, 'POST', '/api/dsh-web-testing/config', { mode: 'observe' })
    assert.equal(update.status, 200)
    assert.deepEqual(update.body.released, { releasedRequests: 1, releasedResponses: 0 })
    await browserRequest

    assert.equal(status, 200)
    assert.equal(raw, 'live-config-ok')
    assert.equal(runtime.state.pending.size, 0)
    assert.equal(runtime.state.flows[0].metadata.pendingStage, undefined)
    assert.equal(runtime.state.flows[0].metadata.configAutoReleased, true)
  } finally {
    await new Promise(resolve => upstream.close(resolve))
  }
})

test('MITM proxy and active Fuzzer both allow authorized private destinations', async () => {
  const upstream = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('private-mitm-ok')
  })
  await new Promise((resolve, reject) => {
    upstream.once('error', reject)
    upstream.listen({ host: '127.0.0.1', port: 0 }, resolve)
  })
  const address = upstream.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const runtime = makeRuntime(normalizeConfig())
  runtime.state.mitm.mode = 'observe'
  runtime.state.mitm.holdResponse = false
  let proxy
  try {
    proxy = await runtime.startProxy({ host: '127.0.0.1', port: 0 })
    const response = await new Promise((resolve, reject) => {
      const request = httpRequest({
        host: proxy.host,
        port: proxy.port,
        method: 'GET',
        path: `http://127.0.0.1:${port}/private`,
      }, result => {
        const chunks = []
        result.on('data', chunk => chunks.push(Buffer.from(chunk)))
        result.on('end', () => resolve({ status: result.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
      })
      request.once('error', reject)
      request.end()
    })
    assert.equal(response.status, 200)
    assert.equal(response.body, 'private-mitm-ok')
    assert.equal(runtime.state.flows[0].source, 'proxy')

    const fuzz = await runtime.runFuzzer({
      request: { raw: `GET http://127.0.0.1:${port}/private HTTP/1.1\nHost: 127.0.0.1:${port}\n\n` },
      payloads: {},
    })
    assert.equal(fuzz.total, 1)
    assert.equal(fuzz.matched, 1)
    assert.equal(fuzz.results[0].status, 200)
  } finally {
    await runtime.stopProxy()
    await new Promise(resolve => upstream.close(resolve))
  }
})

test('Fuzzer flow details expose concrete request and response packets', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(201, { 'content-type': 'text/plain; charset=utf-8', 'x-test': 'ok' })
    res.end('response-body')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen({ host: '127.0.0.1', port: 0 }, resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const runtime = makeRuntime(normalizeConfig())
  try {
    const result = await runtime.runFuzzer({
      request: { raw: `POST http://127.0.0.1:${port}/echo HTTP/1.1\nHost: 127.0.0.1:${port}\nContent-Type: text/plain\n\nrequest-body` },
      payloads: {},
      assertions: { status: [201], contains: 'response-body' },
    })
    assert.equal(result.matched, 1)
    assert.ok(result.results[0].flowId)

    let status
    let body
    await runtime.apiHandler(
      { method: 'GET', url: `/api/dsh-web-testing/flow/${encodeURIComponent(result.results[0].flowId)}` },
      {
        writeHead(code) { status = code },
        end(value) { body = JSON.parse(value) },
      },
    )
    assert.equal(status, 200)
    assert.equal(body.flow.request.full.text, 'request-body')
    assert.equal(body.flow.response.full.text, 'response-body')
    assert.equal(body.flow.status, 201)
    assert.equal(body.flow.responseHeaders['x-test'], 'ok')
    assert.equal(body.flow.requestId, result.results[0].flowId)
    assert.equal(body.flow.requestMethod, 'POST')
    assert.equal(body.flow.requestTime, body.flow.startedAt)
    assert.equal(body.flow.responseSizeBytes, Buffer.byteLength('response-body'))
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})

test('Fuzzer records malformed request templates as failed cases', async () => {
  const runtime = makeRuntime(normalizeConfig())
  const result = await runtime.runFuzzer({
    request: { raw: 'GET /missing-host HTTP/1.1\n\n' },
    payloads: { user: ['admin', 'guest'] },
    concurrency: 2,
  })
  assert.equal(result.total, 2)
  assert.equal(result.failed, 2)
  assert.equal(result.results[0].matched, false)
  assert.match(result.results[0].reasons[0], /Host header/)
})

test('Fuzzer network settings support an HTTP proxy and validate TLS options', async () => {
  let proxyUrl
  let proxyAuth
  const proxy = createServer((req, res) => {
    proxyUrl = req.url
    proxyAuth = req.headers['proxy-authorization']
    res.writeHead(202, { 'content-type': 'text/plain' })
    res.end('proxy-response')
  })
  await new Promise((resolve, reject) => {
    proxy.once('error', reject)
    proxy.listen({ host: '127.0.0.1', port: 0 }, resolve)
  })
  const address = proxy.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const runtime = makeRuntime(normalizeConfig())
  try {
    const result = await runtime.runFuzzer({
      request: { raw: 'GET http://localhost/proxied HTTP/1.1\nHost: localhost\n\n' },
      payloads: {},
      network: { proxyUrl: `http://proxy-user:proxy-pass@127.0.0.1:${port}` },
    })
    assert.equal(result.matched, 1)
    assert.equal(result.results[0].status, 202)
    const resolved = await resolveTargetAddresses(new URL('http://localhost/proxied'))
    const authority = resolved[0].includes(':') ? `[${resolved[0]}]` : resolved[0]
    assert.equal(proxyUrl, `http://${authority}/proxied`)
    assert.match(proxyAuth, /^Basic /)
    assert.equal(normalizeNetwork({ proxyUrl: 'socks5://127.0.0.1:1080', forceHttps: true }).forceHttps, true)
    assert.throws(() => normalizeNetwork({ cert: 'client-cert' }), /客户端证书和客户端私钥/)
    assert.equal('interceptHttps' in normalizeNetwork({ interceptHttps: true }), false)
  } finally {
    await new Promise(resolve => proxy.close(resolve))
  }
})

test('Fuzzer network settings support a custom CA and forced HTTPS', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-resource-center-tls-'))
  const keyPath = join(directory, 'key.pem')
  const certPath = join(directory, 'cert.pem')
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' })
  const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)])
  const server = createHttpsServer({ key, cert }, (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('tls-response')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen({ host: '127.0.0.1', port: 0 }, resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  const runtime = makeRuntime(normalizeConfig())
  try {
    const result = await runtime.runFuzzer({
      request: { raw: `GET http://localhost:${port}/tls HTTP/1.1\nHost: localhost:${port}\n\n` },
      payloads: {},
      network: { ca: cert.toString('utf8'), forceHttps: true },
    })
    assert.equal(result.matched, 1)
    assert.equal(result.results[0].status, 200)
  } finally {
    await new Promise(resolve => server.close(resolve))
    await rm(directory, { recursive: true, force: true })
  }
})

test('MITM config supports route/suffix rules and HaE defaults', async () => {
  const runtime = makeRuntime(normalizeConfig())
  const result = await callRuntimeApi(runtime, 'POST', '/api/dsh-web-testing/config', {
    listenHost: '127.0.0.1',
    listenPort: 0,
    mode: 'manual',
    interceptRoutes: ['/api/'],
    interceptSuffixes: ['.json'],
    autoReleaseRules: [{ match: { method: 'GET', pathContains: '/health' } }],
    holdResponse: true,
    haeEnabled: true,
    haeRules: [{ id: 'email', name: 'Email', regex: '[^ ]+@example\\.com', color: '#bde7ff' }],
  })
  assert.equal(result.status, 200)
  assert.deepEqual(result.body.mitm.interceptRoutes, ['/api/'])
  assert.deepEqual(result.body.mitm.interceptSuffixes, ['.json'])
    assert.equal(result.body.mitm.autoReleaseRules.length, 1)
    assert.equal(result.body.mitm.haeRules[0].id, 'email')
    assert.equal(result.body.mitm.haeRules[0].flags, 'g')
  const status = await callRuntimeApi(runtime, 'GET', '/api/dsh-web-testing/status')
  assert.equal(status.body.mitm.mode, 'manual')
  assert.equal(status.body.mitm.holdResponse, true)
})

test('MITM partial config updates preserve existing settings', async () => {
  const runtime = makeRuntime(normalizeConfig())
  const initial = await callRuntimeApi(runtime, 'POST', '/api/dsh-web-testing/config', {
    listenHost: '127.0.0.1',
    listenPort: 4321,
    mode: 'manual',
    interceptRoutes: ['/api/'],
    interceptSuffixes: ['.json'],
    holdResponse: false,
    haeEnabled: true,
    haeRules: [{ id: 'token', name: 'Token', regex: 'token=[^ ]+' }],
  })
  assert.equal(initial.status, 200)

  const partial = await callRuntimeApi(runtime, 'POST', '/api/dsh-web-testing/config', { haeEnabled: false })
  assert.equal(partial.status, 200)
  assert.equal(partial.body.mitm.listenPort, 4321)
  assert.equal(partial.body.mitm.mode, 'manual')
  assert.deepEqual(partial.body.mitm.interceptRoutes, ['/api/'])
  assert.deepEqual(partial.body.mitm.interceptSuffixes, ['.json'])
  assert.equal(partial.body.mitm.holdResponse, false)
  assert.equal(partial.body.mitm.haeEnabled, false)
  assert.equal(partial.body.mitm.haeRules[0].id, 'token')
})

test('MITM keeps the configured auto-port separate from the active endpoint port', async () => {
  const runtime = makeRuntime(normalizeConfig())
  try {
    assert.equal(runtime.state.mitm.listenPort, 0)
    const endpoint = await runtime.startProxy({ host: '127.0.0.1', port: 0 })
    assert.ok(endpoint.port > 0)
    assert.equal(runtime.state.mitm.listenPort, 0)
    const status = await callRuntimeApi(runtime, 'GET', '/api/dsh-web-testing/status')
    assert.equal(status.body.proxy.port, endpoint.port)
    assert.equal(status.body.mitm.listenPort, 0)
  } finally {
    await runtime.stopProxy()
  }
})

test('MITM start and stop are serialized across concurrent callers', async () => {
  const runtime = makeRuntime(normalizeConfig())
  try {
    const endpoints = await Promise.all([
      runtime.startProxy({ host: '127.0.0.1', port: 0 }),
      runtime.startProxy({ host: '127.0.0.1', port: 0 }),
      runtime.startProxy({ host: '127.0.0.1', port: 0 }),
    ])
    assert.ok(endpoints.every(endpoint => endpoint.port === endpoints[0].port))
    await Promise.all([runtime.stopProxy(), runtime.stopProxy(), runtime.stopProxy()])
    const stopped = await callRuntimeApi(runtime, 'GET', '/api/dsh-web-testing/status')
    assert.equal(stopped.body.proxy, null)
  } finally {
    await runtime.stopProxy()
  }
})

test('MITM manually holds a request, then holds and replaces its response', async () => {
  const target = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'x-upstream': 'yes' })
    res.end('Bearer upstream-token alice@example.com')
  })
  await new Promise((resolve, reject) => {
    target.once('error', reject)
    target.listen({ host: '127.0.0.1', port: 0 }, resolve)
  })
  const targetAddress = target.address()
  const targetPort = typeof targetAddress === 'object' && targetAddress ? targetAddress.port : 0
  const runtime = makeRuntime(normalizeConfig())
  let proxy
  try {
    await callRuntimeApi(runtime, 'POST', '/api/dsh-web-testing/config', {
      listenHost: '127.0.0.1',
      listenPort: 0,
      mode: 'manual',
      interceptRoutes: ['/api/'],
      interceptSuffixes: ['.json'],
      holdResponse: true,
      haeEnabled: true,
      haeRules: [{ id: 'secret', name: 'Secret', regex: 'Bearer\\s+[^ ]+', flags: 'g', color: '#ffe08a' }],
    })
    proxy = await runtime.startProxy({ host: '127.0.0.1', port: 0 })
    const clientResponse = new Promise((resolve, reject) => {
      const request = httpRequest({
        host: proxy.host,
        port: proxy.port,
        method: 'GET',
        path: `http://127.0.0.1:${targetPort}/api/data.json`,
      }, response => {
        const chunks = []
        response.on('data', chunk => chunks.push(Buffer.from(chunk)))
        response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
      })
      request.once('error', reject)
      request.end()
    })

    const requestFlow = await waitFor(() => runtime.state.flows[0]?.metadata.pendingStage === 'request' && runtime.state.flows[0])
    assert.equal(requestFlow.url, `http://127.0.0.1:${targetPort}/api/data.json`)
    let action = await callRuntimeApi(runtime, 'POST', `/api/dsh-web-testing/flow/${encodeURIComponent(requestFlow.id)}/action`, { action: 'release-request' })
    assert.equal(action.status, 200)
    await waitFor(() => runtime.state.flows[0]?.metadata.pendingStage === 'response')
    action = await callRuntimeApi(runtime, 'POST', `/api/dsh-web-testing/flow/${encodeURIComponent(requestFlow.id)}/action`, {
      action: 'replace-response',
      status: 201,
      headers: { 'content-type': 'text/plain' },
      body: 'Bearer replaced@example.com',
    })
    assert.equal(action.status, 200)
    const response = await clientResponse
    assert.equal(response.status, 201)
    assert.equal(response.body, 'Bearer replaced@example.com')

    const detail = await callRuntimeApi(runtime, 'GET', `/api/dsh-web-testing/flow/${encodeURIComponent(requestFlow.id)}`)
    assert.equal(detail.body.flow.metadata.responseOverridden, true)
    assert.equal(detail.body.flow.response.full.text, 'Bearer replaced@example.com')
    assert.equal(detail.body.flow.highlights.response.length, 1)
    assert.equal(detail.body.flow.highlights.response[0].name, 'Secret')

    await callRuntimeApi(runtime, 'POST', '/api/dsh-web-testing/config', { haeEnabled: false })
    const disabled = await callRuntimeApi(runtime, 'GET', `/api/dsh-web-testing/flow/${encodeURIComponent(requestFlow.id)}`)
    assert.equal(disabled.body.flow.metadata.haeCount, 0)
    assert.equal(disabled.body.flow.highlights.response.length, 0)

    await callRuntimeApi(runtime, 'POST', '/api/dsh-web-testing/config', {
      haeEnabled: true,
      haeRules: [{ id: 'email', name: 'Email', regex: '[^ ]+@example\\.com', color: '#bde7ff' }],
    })
    const reprocessed = await callRuntimeApi(runtime, 'GET', `/api/dsh-web-testing/flow/${encodeURIComponent(requestFlow.id)}`)
    assert.equal(reprocessed.body.flow.highlights.response.length, 1)
    assert.equal(reprocessed.body.flow.highlights.response[0].name, 'Email')
  } finally {
    await runtime.stopProxy()
    await new Promise(resolve => target.close(resolve))
  }
})
