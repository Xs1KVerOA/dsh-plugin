import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import { WebSocketServer } from 'ws'
import { assertSecuritySession, assertTargetAllowed, createRuntime, normalizeTarget, scoreCvss31, securityDomain, targetKey } from '../index.js'

function securityExec(sessionId = 'session-1', overrides = {}) {
  return { sessionId, callId: 'call-1', agent: { session: { id: sessionId, header: { agentPreset: 'security' } } }, approval: { request: async () => 'allowed-once' }, ...overrides }
}

function auditExec(sessionId = 'audit-session') {
  return { sessionId, callId: 'call-audit', agent: { session: { id: sessionId, header: { agentPreset: 'code-audit' } } } }
}

test('normalizes supported targets and groups by hostname:port', () => {
  const url = normalizeTarget('https://Example.com/path')
  assert.equal(url.protocol, 'https:')
  assert.equal(targetKey(url), 'example.com:443')
  assert.throws(() => normalizeTarget('file:///tmp/test'), /仅支持/)
})

test('keeps the removed allowlist disabled regardless of legacy configuration', () => {
  assert.equal(createRuntime().config.requireAllowlist, false)
  assert.equal(createRuntime({ requireAllowlist: true, allowedHosts: ['example.com'] }).config.requireAllowlist, false)
})

test('blocks IPv6 private and IPv4-mapped IPv6 targets by default', async () => {
  const config = { allowPrivateTargets: false, requireAllowlist: false, dnsLookupTimeoutMs: 200 }
  await assert.rejects(() => assertTargetAllowed(normalizeTarget('http://[fc00::1]/'), config), /私有地址/)
  await assert.rejects(() => assertTargetAllowed(normalizeTarget('http://[::ffff:127.0.0.1]/'), config), /私有地址/)
  await assert.rejects(() => assertTargetAllowed(normalizeTarget('http://100.127.0.4/'), config), /私有地址/)
})

test('asks for approval before a private target can be reached', async () => {
  const runtime = createRuntime({ allowPrivateTargets: true })
  let request
  const exec = securityExec('approval-rejected', { approval: { request: async value => { request = value; return 'rejected' } } })
  await assert.rejects(() => runtime.request({ url: 'http://100.127.0.4/' }, exec), /用户拒绝访问私网\/内部地址/)
  assert.equal(request.toolName, 'dsh_security_request')
  assert.equal(request.grantKey, 'dsh-security:protected-target')
  assert.match(request.reason, /100\.127\.0\.4/)
})

test('asks for approval when hostname resolution returns a local address', async () => {
  const runtime = createRuntime()
  let request
  const exec = securityExec('hostname-approval', { approval: { request: async value => { request = value; return 'rejected' } } })
  await assert.rejects(() => runtime.request({ url: 'http://localhost/' }, exec), /用户拒绝访问私网\/内部地址/)
  assert.equal(request.toolName, 'dsh_security_request')
  assert.match(request.reason, /127\.0\.0\.1|::1/)
})

test('fails closed when a private-target approval channel is unavailable', async () => {
  const runtime = createRuntime()
  const exec = securityExec('approval-unavailable', { approval: undefined })
  await assert.rejects(() => runtime.request({ url: 'http://127.0.0.1/' }, exec), /审批服务不可用/)
})

test('rejects non-security sessions before network access', () => {
  assert.throws(() => assertSecuritySession({ agent: { session: { header: { agentPreset: 'standard' } } } }), /仅可在安全模式/)
})

test('uses the latest logged preset selection instead of the creation header', () => {
  const session = {
    id: 'selected',
    header: { agentPreset: 'standard' },
    events: [{ type: 'agent-preset/selected', data: { agentPreset: 'pentest' } }],
  }
  assert.doesNotThrow(() => assertSecuritySession({ sessionId: 'selected', agent: { session } }))
})

test('authorizes child sessions from their security-mode ancestor', async () => {
  const sessions = new Map([
    ['parent-pentest', { header: { agentPreset: 'pentest' } }],
    ['child-pentest', { header: { parentSession: 'parent-pentest' } }],
    ['parent-audit', { header: { agentPreset: 'code-audit' } }],
    ['child-audit', { header: { parentSession: 'parent-audit' } }],
  ])
  const runtime = createRuntime({ allowedHosts: ['example.com'], requireAllowlist: true }, undefined, sessions)
  const pentestExec = { sessionId: 'child-pentest', agent: { session: { id: 'child-pentest', header: { parentSession: 'parent-pentest' } } } }
  const auditExec = { sessionId: 'child-audit', agent: { session: { id: 'child-audit', header: { parentSession: 'parent-audit' } } } }
  await runtime.addFact({ detail: 'child pentest fact' }, pentestExec)
  const run = await runtime.auditStart({ targetPath: '/repo' }, auditExec)
  assert.equal(run.sessionId, 'child-audit')
})

test('records HTTP request and response packets', async t => {
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'text/plain')
    response.end('ok')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const port = server.address().port
  const runtime = createRuntime({ allowedHosts: ['127.0.0.1'], allowPrivateTargets: true, requireAllowlist: true })
  const result = await runtime.request({ url: `http://127.0.0.1:${port}/health?token=should-not-persist`, method: 'GET' }, securityExec())
  assert.equal(result.status, 200)
  assert.match(result.target, /token=%5BREDACTED%5D/)
  assert.doesNotMatch(result.requestPacket, /should-not-persist/)
  const history = await runtime.history('session-1')
  assert.equal(history.length, 1)
  assert.match(history[0].requestPacket, /GET \/health\?token=%5BREDACTED%5D HTTP\/1\.1/)
  assert.match(history[0].responsePacket, /HTTP\/1\.1 200/)
})

test('honors per-request timeout and rejects oversized request bodies', async t => {
  const server = http.createServer((_request, response) => setTimeout(() => response.end('late'), 180))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const port = server.address().port
  const runtime = createRuntime({ allowedHosts: ['127.0.0.1'], allowPrivateTargets: true, timeoutMs: 1000, maxPacketBytes: 1024 })
  const result = await runtime.request({ url: `http://127.0.0.1:${port}/slow`, timeoutMs: 30 }, securityExec('timeout'))
  assert.match(result.error, /超时/)
  await assert.rejects(() => runtime.request({ url: `http://127.0.0.1:${port}/`, method: 'POST', body: 'x'.repeat(2048) }, securityExec('oversized')), /请求体超过上限/)
  await assert.rejects(() => runtime.request({ url: `http://127.0.0.1:${port}/`, method: 'GET', body: 'not-sent' }, securityExec('get-body')), /GET 请求不支持请求体/)
  await assert.rejects(() => runtime.request({ url: `http://127.0.0.1:${port}/`, messages: ['not-sent'] }, securityExec('http-messages')), /HTTP\/HTTPS 请求不支持 messages/)
  await assert.rejects(() => runtime.request({ url: `http://127.0.0.1:${port}/`, headers: { 'x-large': 'x'.repeat(1024) } }, securityExec('oversized-header')), /请求头总大小超过上限/)
})

test('caps aggregate WebSocket request messages', async () => {
  const runtime = createRuntime({ allowedHosts: ['127.0.0.1'], allowPrivateTargets: true, maxPacketBytes: 1024 })
  await assert.rejects(() => runtime.request({ url: 'ws://127.0.0.1:1/socket', messages: ['a'.repeat(600), 'b'.repeat(600)] }, securityExec('ws-oversized')), /消息总大小超过上限/)
})

test('records WebSocket messages in the same session history', async t => {
  const server = http.createServer()
  const wss = new WebSocketServer({ server })
  wss.on('connection', socket => socket.on('message', message => socket.send(`echo:${message.toString()}`)))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { wss.close(); server.close() })
  const port = server.address().port
  const runtime = createRuntime({ allowedHosts: ['127.0.0.1'], allowPrivateTargets: true, websocketWaitMs: 80 })
  const result = await runtime.request({ url: `ws://127.0.0.1:${port}/socket`, messages: ['hello'], waitMs: 80 }, securityExec())
  assert.equal(result.status, 101)
  const history = await runtime.history('session-1')
  assert.equal(history[0].protocol, 'ws')
  assert.match(history[0].requestPacket, />> hello/)
  assert.match(history[0].responsePacket, /HTTP\/1\.1 101/)
  assert.match(history[0].responsePacket, /<< echo:hello/)
  assert.match(JSON.stringify(history[0].response), /echo:hello/)
  assert.doesNotThrow(() => securityDomain.tables.exchanges.valueSchema.parse(history[0]))
})

test('marks truncated WebSocket responses instead of reporting a complete exchange', async t => {
  const server = http.createServer()
  const wss = new WebSocketServer({ server })
  wss.on('connection', socket => socket.on('message', () => { socket.send('first'); socket.send('second') }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { wss.close(); server.close() })
  const port = server.address().port
  const runtime = createRuntime({ allowedHosts: ['127.0.0.1'], allowPrivateTargets: true, maxWebSocketMessages: 1, websocketWaitMs: 80 })
  const result = await runtime.request({ url: `ws://127.0.0.1:${port}/socket`, messages: ['hello'], waitMs: 80 }, securityExec('ws-truncated'))
  assert.equal(result.status, 101)
  assert.match(result.responsePacket, /响应内容已截断/)
  assert.equal((await runtime.history('ws-truncated'))[0].response.truncated, true)
})

test('merges reports by hostname:port', async () => {
  const runtime = createRuntime({ allowedHosts: ['example.com'], requireAllowlist: true, allowPrivateTargets: true })
  const exec = securityExec('session-2')
  await runtime.report({ target: 'https://example.com/a', title: 'Header', markdown: '发现缺少安全响应头。' }, exec)
  await runtime.report({ target: 'https://example.com/b', title: 'Cookie', markdown: 'Cookie 未设置 Secure。' }, exec)
  await runtime.report({ target: 'https://other.example.com/', title: 'Other', markdown: '白名单机制已移除。' }, exec)
  const reports = await runtime.reports('session-2')
  assert.equal(reports.length, 2)
  assert.match(reports[0].markdown, /Header/)
  assert.match(reports[0].markdown, /Cookie/)
})

test('stores structured engagement data and renders it into the Markdown report', async () => {
  const runtime = createRuntime({ allowedHosts: ['example.com'], requireAllowlist: true, allowPrivateTargets: true })
  const exec = securityExec('session-3')
  await runtime.start({ target: 'https://example.com', objective: '验证认证边界', authorization: 'written scope' }, exec)
  await runtime.addAsset({ type: 'web', value: 'https://example.com/login', meta: '登录入口' }, exec)
  await runtime.addFact({ target: 'https://example.com', detail: '登录接口返回 401', kind: 'HTTP response', confidence: 0.9 }, exec)
  await runtime.addFinding({ target: 'https://example.com', title: '缺少安全响应头', severity: 'low', description: '响应缺少 CSP', reproducibleSteps: ['GET /'] }, exec)
  const report = await runtime.report({ target: 'https://example.com', title: '认证边界报告', markdown: '需要进一步验证。' }, exec)
  const state = await runtime.state('session-3')
  assert.equal(state.goals.length, 1)
  assert.equal(state.assets.length, 1)
  assert.equal(state.facts.length, 1)
  assert.equal(state.findings.length, 1)
  assert.match(report.markdown, /Structured engagement record/)
  assert.match(report.markdown, /缺少安全响应头/)
  assert.match(report.markdown, /登录接口返回 401/)
})

test('records an engagement and report without requiring target DNS resolution', async () => {
  const runtime = createRuntime()
  const exec = securityExec('unresolved-target')
  const goal = await runtime.start({ target: 'https://offline-target.invalid:8443', objective: '验证 DNS 故障', authorization: 'written scope' }, exec)
  assert.equal(goal.target, 'https://offline-target.invalid:8443/')
  const report = await runtime.report({ target: 'offline-target.invalid:8443', title: 'DNS 诊断', markdown: '本地解析器超时；目标解析状态待复核。' }, exec)
  assert.equal(report.key, 'offline-target.invalid:8443')
  assert.match(report.markdown, /DNS 诊断/)
  assert.equal((await runtime.reports('unresolved-target')).length, 1)
})

test('serializes concurrent structured writes and paginates reports', async () => {
  const runtime = createRuntime({ allowedHosts: ['127.0.0.1'], allowPrivateTargets: true, maxReportBytes: 1024 })
  const exec = securityExec('concurrent')
  await Promise.all([
    runtime.addAsset({ type: 'web', value: 'http://127.0.0.1:8001' }, exec),
    runtime.addAsset({ type: 'web', value: 'http://127.0.0.1:8002' }, exec),
  ])
  const state = await runtime.state('concurrent')
  assert.equal(state.assets.length, 2)
  await runtime.report({ target: 'http://127.0.0.1:8001', title: 'one', markdown: 'a'.repeat(1000) }, exec)
  await runtime.report({ target: 'http://127.0.0.1:8002', title: 'two', markdown: 'b'.repeat(1000) }, exec)
  const page = await runtime.reports('concurrent', { limit: 1 })
  assert.equal(page.items.length, 1)
  assert.equal(page.hasMore, true)
  const next = await runtime.reports('concurrent', { limit: 1, cursor: page.nextCursor })
  assert.equal(next.items.length, 1)
  assert.equal(next.hasMore, false)
  assert.ok((await runtime.reports('concurrent'))[0].markdown.length <= 1024)
})

test('stores code-audit API inventory, candidates, and structured reports separately', async () => {
  const runtime = createRuntime({ maxReportBytes: 4096 })
  const exec = auditExec()
  const run = await runtime.auditStart({ targetPath: '/repo/pam', language: 'go', scope: 'HTTP and RPC entrypoints' }, exec)
  assert.equal(run.auditMode, 'standard')
  assert.equal(run.graphRequired, false)
  assert.equal(run.graphStatus, 'not-applicable')
  await runtime.auditAddApi({ runId: run.id, entryId: 'http:POST:/api/v1/login', entryType: 'http', method: 'POST', path: '/api/v1/login', handler: 'internal/auth.go:42', auth: 'public', active: 'yes', riskTags: ['auth'], targetPaths: ['internal/web'], contextFiles: ['internal/auth.go', 'internal/middleware/auth.go'], relatedSymbols: ['LoginHandler', 'SessionStore.Lookup'], authGuards: ['RequireUser'], configRefs: ['config.auth.rateLimit'], dataModels: ['User', 'Session'], errorHandlers: ['writeAuthError'], middleware: ['requestID', 'recover'] }, exec)
  await runtime.auditAddCandidate({ runId: run.id, candidateId: 'AUTH-001', domain: 'auth', severity: 'medium', status: 'confirmed', entryId: 'http:POST:/api/v1/login', entryType: 'http', entry: 'POST /api/v1/login', active: 'yes', source: ['internal/auth.go:42 body.token'], sink: ['internal/auth.go:88 session lookup'], evidence: ['internal/auth.go:42-88'], evidenceLocations: [{ file: 'internal/auth.go', lineStart: 42, lineEnd: 88, role: 'flow' }], chain: ['internal/auth.go:42 -> internal/auth.go:88'], guards: ['No rate limit'], impact: '认证接口缺少限流', confidence: 'medium', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N' }, exec)
  await runtime.auditReviewCandidate({ runId: run.id, candidateId: 'AUTH-001', status: 'confirmed', reachable: 'yes', authorization: 'public endpoint; no account requirement', inputValidation: 'token is not rate-limited', productionCode: 'production handler', sufficientEvidence: 'yes', reviewNotes: '入口和处理链已复核' }, exec)
  const report = await runtime.auditReport({ runId: run.id, title: 'PAM 代码审计', summary: '完成入口与认证队列复核', topPriorities: ['补充登录限流'], observations: ['API 清单已结构化'], markdown: '# PAM 代码审计\n\n## 结论\n需要修复。' }, exec)
  assert.equal(report.counts.medium, 1)
  const apis = await runtime.auditApis('audit-session')
  assert.equal(apis.length, 1)
  assert.deepEqual(apis[0].contextFiles, ['internal/auth.go', 'internal/middleware/auth.go'])
  assert.deepEqual(apis[0].authGuards, ['RequireUser'])
  assert.equal((await runtime.auditReports('audit-session')).length, 1)
  assert.equal((await runtime.auditState('audit-session')).candidates.length, 1)
  assert.equal(Object.hasOwn(await runtime.auditState('audit-session', { summaryOnly: true }), 'apis'), false)
  assert.doesNotThrow(() => securityDomain.tables.apis.valueSchema.parse(apis[0]))
})

test('keeps audit IDs distinct when sanitized labels collide', async () => {
  const runtime = createRuntime()
  const exec = auditExec('collision-session')
  const run = await runtime.auditStart({ targetPath: '/repo' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'A/B', path: '/a-b' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'A_B', path: '/a_b' }, exec)
  const candidateBase = { status: 'needs-review', entry: 'GET /example', source: ['source'], sink: ['sink'], evidence: ['example.go:10'], evidenceLocations: [{ file: 'example.go', line: 10 }], impact: '待确认' }
  await runtime.auditAddCandidate({ ...candidateBase, runId: run.id, candidateId: 'A/B', entryId: 'A/B' }, exec)
  await runtime.auditAddCandidate({ ...candidateBase, runId: run.id, candidateId: 'A_B', entryId: 'A_B' }, exec)
  assert.equal((await runtime.auditState('collision-session')).candidates.length, 2)
})

test('scores CVSS 3.1 base vectors and orders findings by score', async () => {
  assert.deepEqual(scoreCvss31('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), { vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', score: 9.8, severity: 'Critical' })
  assert.deepEqual(scoreCvss31('CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H').severity, 'High')
  assert.throws(() => scoreCvss31('CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), /仅支持 CVSS:3.1/)

  const runtime = createRuntime({ maxReportBytes: 4096 })
  const exec = auditExec('cvss-session')
  const run = await runtime.auditStart({ targetPath: '/repo/service', language: 'go' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'LOWER', path: '/low' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'CRITICAL', path: '/admin' }, exec)
  const candidateBase = { status: 'confirmed', source: ['source'], sink: ['sink'], evidence: ['service.go:10'], evidenceLocations: [{ file: 'service.go', line: 10 }], impact: '影响服务安全性' }
  await runtime.auditAddCandidate({ ...candidateBase, runId: run.id, candidateId: 'LOWER', title: '低优先级问题', entryId: 'LOWER', entry: 'GET /low', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H' }, exec)
  await runtime.auditAddCandidate({ ...candidateBase, runId: run.id, candidateId: 'CRITICAL', title: '高优先级问题', entryId: 'CRITICAL', entry: 'POST /admin', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }, exec)
  for (const candidateId of ['LOWER', 'CRITICAL']) await runtime.auditReviewCandidate({ runId: run.id, candidateId, status: 'confirmed', reachable: 'yes', authorization: 'authorization reviewed', inputValidation: 'validation reviewed', productionCode: 'production path', sufficientEvidence: 'yes' }, exec)
  const report = await runtime.auditReport({ runId: run.id }, exec)
  assert.deepEqual(report.findings.map(item => item.candidateId), ['CRITICAL', 'LOWER'])
  assert.equal(report.findings[0].cvssScore, 9.8)
  assert.equal(report.counts.critical, 1)
  assert.equal(report.counts.high, 1)
  assert.match(report.markdown, /CVSS：9\.8/)
})

test('keeps an unscored candidate out of confirmed findings', async () => {
  const runtime = createRuntime()
  const exec = auditExec('cvss-input-session')
  const run = await runtime.auditStart({ targetPath: '/repo' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'F-1', path: '/unscored' }, exec)
  await runtime.auditAddCandidate({ runId: run.id, candidateId: 'F-1', entryId: 'F-1', entry: 'GET /unscored', source: ['source'], sink: ['sink'], evidence: ['service.go:20'], evidenceLocations: [{ file: 'service.go', line: 20 }], impact: '待确认' }, exec)
  const report = await runtime.auditReport({ runId: run.id }, exec)
  assert.equal(report.findings.length, 0)
  assert.equal(report.reviewItems.length, 1)
  assert.equal(report.reviewItems[0].cvssScore, null)
  assert.equal(report.counts.medium, 0)
})

test('reviews candidates, excludes false positives, and reports API coverage', async () => {
  const runtime = createRuntime()
  const exec = auditExec('review-session')
  const run = await runtime.auditStart({ targetPath: '/repo/service' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'CONFIRMED', method: 'GET', path: '/confirmed' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'FALSE', method: 'GET', path: '/false' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'UNTOUCHED', method: 'GET', path: '/untouched' }, exec)
  await runtime.auditAddApi({ runId: run.id, entryId: 'NO-CANDIDATE', method: 'GET', path: '/no-candidate' }, exec)
  await assert.rejects(() => runtime.auditAddCandidate({ runId: run.id, candidateId: 'ORPHAN', entryId: 'MISSING', entry: 'GET /missing', source: ['source'], sink: ['sink'], evidence: ['service.go:1'], evidenceLocations: [{ file: 'service.go', line: 1 }], impact: '影响' }, exec), /必须关联当前运行中的 API/)
  const base = { entry: 'GET /candidate', source: ['handler input'], sink: ['database query'], evidence: ['service.go:10'], evidenceLocations: [{ file: 'service.go', line: 10 }], impact: '影响服务安全性' }
  const confirmed = await runtime.auditAddCandidate({ ...base, runId: run.id, candidateId: 'CONFIRMED', entryId: 'CONFIRMED', status: 'confirmed', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }, exec)
  assert.equal(confirmed.status, 'needs-review')
  const confirmedReview = await runtime.auditReviewCandidate({ runId: run.id, candidateId: 'CONFIRMED', status: 'confirmed', reachable: 'yes', authorization: 'missing guard', inputValidation: 'validated as absent', productionCode: 'production path', sufficientEvidence: 'yes' }, exec)
  assert.equal(confirmedReview.status, 'confirmed')
  const falsePositive = await runtime.auditAddCandidate({ ...base, runId: run.id, candidateId: 'FALSE', entryId: 'FALSE', status: 'false-positive', cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:N/A:N' }, exec)
  assert.equal(falsePositive.status, 'needs-review')
  const excluded = await runtime.auditReviewCandidate({ runId: run.id, candidateId: 'FALSE', status: 'false-positive', reachable: 'yes', authorization: 'protected', inputValidation: 'validated', productionCode: 'test-only path', sufficientEvidence: 'yes', reviewNotes: '仅测试代码' }, exec)
  assert.equal(excluded.status, 'false-positive')
  const pending = await runtime.auditAddCandidate({ ...base, runId: run.id, candidateId: 'UNTOUCHED', entryId: 'UNTOUCHED', status: 'confirmed' }, exec)
  assert.equal(pending.status, 'needs-review')
  const incomplete = await runtime.auditReviewCandidate({ runId: run.id, candidateId: 'UNTOUCHED', status: 'confirmed' }, exec)
  assert.equal(incomplete.status, 'needs-review')
  const reviewed = await runtime.auditReviewCandidate({ runId: run.id, candidateId: 'UNTOUCHED', status: 'confirmed', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N', reachable: 'yes', authorization: '已检查访问控制', inputValidation: '已检查输入校验', productionCode: '生产代码', sufficientEvidence: 'yes', reviewNotes: '已补充访问控制证据' }, exec)
  assert.equal(reviewed.status, 'confirmed')
  assert.equal(reviewed.selfCheck.sufficientEvidence, 'yes')
  const report = await runtime.auditReport({ runId: run.id }, exec)
  assert.deepEqual(report.findings.map(item => item.candidateId), ['CONFIRMED', 'UNTOUCHED'])
  assert.equal(report.excludedItems.length, 1)
  assert.equal(report.excludedItems[0].candidateId, 'FALSE')
  assert.equal(report.coverage.total, 4)
  assert.equal(report.coverage.covered, 3)
  assert.equal(report.coverage.uncovered, 1)
  assert.equal(report.coverage.uncoveredEntries[0].entryId, 'NO-CANDIDATE')
  assert.match(report.markdown, /待复核项/)
  assert.match(report.markdown, /已排除项/)
  assert.match(report.markdown, /接受风险/)
  assert.match(report.markdown, /未覆盖入口/)
})

test('stores structured product understanding in the audit run', async () => {
  const runtime = createRuntime()
  const exec = auditExec('understanding-session')
  const run = await runtime.auditStart({ targetPath: '/repo/product', language: 'go' }, exec)
  const result = await runtime.auditUpdateUnderstanding({ runId: run.id, productSummary: '内部配置管理服务', productPurpose: '管理组织配置和权限', coreCapabilities: ['用户登录', '配置发布'], boundaries: ['仅本地部署', '不包含公网代理'], assumptions: ['运行于 Linux'], techStack: [{ category: '后端', items: [{ label: '语言', value: 'Go' }] }] }, exec)
  assert.equal(result.understanding.techStack[0].items[0].value, 'Go')
  const state = await runtime.auditState('understanding-session')
  assert.equal(state.run.productUnderstanding.productPurpose, '管理组织配置和权限')
  assert.doesNotThrow(() => securityDomain.tables.audit_runs.valueSchema.parse(state.run))
})

test('stores API inventory metadata for the audit table and accepts flat tech stack input', async () => {
  const runtime = createRuntime()
  const exec = auditExec('api-inventory-session')
  const run = await runtime.auditStart({ targetPath: '/repo/product', language: 'Go' }, exec)
  const understanding = await runtime.auditUpdateUnderstanding({ runId: run.id, techStack: [{ language: 'Go', framework: 'gin' }] }, exec)
  assert.deepEqual(understanding.understanding.techStack[0].items, [{ label: 'language', value: 'Go' }, { label: 'framework', value: 'gin' }])
  const api = await runtime.auditAddApi({ runId: run.id, entryId: 'GET /api/users', entryType: 'http', method: 'GET', path: '/api/users', handler: 'UserHandler.List', riskTags: ['auth-missing'], confidence: 'high', auditDomains: ['auth', 'secrets'] }, exec)
  assert.equal(api.language, 'Go')
  assert.equal(api.sourceConfidence, 'high')
  assert.equal(api.aiAuthConclusion, 'auth-risk')
  assert.equal(api.auditCoverage, 'extracted')
  assert.deepEqual(api.auditDomains, ['auth', 'secrets'])
  assert.doesNotThrow(() => securityDomain.tables.apis.valueSchema.parse(api))
})
