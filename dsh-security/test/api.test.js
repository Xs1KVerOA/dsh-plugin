import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../index.js'

function responseCapture() {
  return {
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body) { this.body = body || '' },
  }
}

test('protects browser API routes with a page token and same-origin check', async () => {
  const routes = []
  const securitySession = { id: 'secret', header: { agentPreset: 'security' } }
  const childSession = { id: 'child', header: { parentSession: 'secret' } }
  const auditSession = { id: 'audit', header: { agentPreset: 'code-audit', title: '示例代码审计' } }
  const standardSession = { id: 'standard', header: { agentPreset: 'standard' } }
  const sessions = {
    get(id) { return id === 'secret' ? securitySession : id === 'child' ? childSession : id === 'audit' ? auditSession : id === 'standard' ? standardSession : undefined },
    list() { return [securitySession, childSession, auditSession, standardSession] },
  }
  const records = new Map()
  const storageDomain = {
    async open() {
      return {
        table(name) {
          if (!records.has(name)) records.set(name, new Map())
          const table = records.get(name)
          return {
            async put(key, value) { table.set(key, value) },
            get(key) { return table.get(key) },
            entries() { return table.entries() },
            async delete(key) { table.delete(key) },
          }
        },
        async close() {},
      }
    },
  }
  let provided
  const ctx = {
    storageDomain,
    get(name) {
      if (name === 'webServer') return { register(route) { routes.push(route); return () => {} } }
      if (name === 'sessions') return sessions
      if (name === 'storageDomain') return storageDomain
      throw new Error(`unexpected dependency ${name}`)
    },
    provide(name, value) { provided = { name, value } },
    effect(effect) { return effect() },
  }
  apply(ctx, { allowedHosts: [], allowPrivateTargets: true, requireAllowlist: false })
  const runtime = provided.value
  const route = routes[0]
  const bootstrapResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/bootstrap', headers: {} }, bootstrapResponse)
  assert.equal(bootstrapResponse.status, 200)
  const token = JSON.parse(bootstrapResponse.body).token
  assert.ok(token)

  const deniedResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/history?sessionId=secret', headers: {} }, deniedResponse)
  assert.equal(deniedResponse.status, 403)

  const originDeniedResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/history?sessionId=secret', headers: { 'x-dsh-security-token': token, origin: 'http://attacker.invalid', host: '127.0.0.1:3000' } }, originDeniedResponse)
  assert.equal(originDeniedResponse.status, 403)

  const ordinaryResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/history?sessionId=ordinary', headers: { 'x-dsh-security-token': token } }, ordinaryResponse)
  assert.equal(ordinaryResponse.status, 404)

  const allowedResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/history?sessionId=secret', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'secret' } }, allowedResponse)
  assert.equal(allowedResponse.status, 200, allowedResponse.body)

  const statusResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/status?sessionId=child', headers: { 'x-dsh-security-token': token } }, statusResponse)
  assert.equal(statusResponse.status, 200)
  assert.equal(JSON.parse(statusResponse.body).security, true)

  const ordinaryStatusResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/status?sessionId=standard', headers: { 'x-dsh-security-token': token } }, ordinaryStatusResponse)
  assert.equal(ordinaryStatusResponse.status, 200)
  assert.deepEqual(JSON.parse(ordinaryStatusResponse.body), { ok: true, security: false, mode: null })

  const configResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/config?sessionId=child', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'child' } }, configResponse)
  assert.equal(configResponse.status, 200)
  assert.equal(JSON.parse(configResponse.body).requireAllowlist, false)

  const policyResponse = responseCapture()
  await route.handler({ method: 'POST', url: '/api/dsh-security/config?sessionId=secret', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'secret' }, body: JSON.stringify({ requireAllowlist: true, allowedHosts: [' Example.com ', '*.Authorized.example'] }) }, policyResponse)
  assert.equal(policyResponse.status, 200, policyResponse.body)
  assert.deepEqual(JSON.parse(policyResponse.body).allowedHosts, [])
  assert.equal(runtime.config.requireAllowlist, false)

  const secretConfigResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/config?sessionId=secret', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'secret' } }, secretConfigResponse)
  assert.equal(JSON.parse(secretConfigResponse.body).requireAllowlist, false)
  assert.equal(JSON.parse(configResponse.body).requireAllowlist, false)

  const childParentResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/history?sessionId=secret', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'child' } }, childParentResponse)
  assert.equal(childParentResponse.status, 403)

  const auditResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/audit/apis?sessionId=audit', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'audit' } }, auditResponse)
  assert.equal(auditResponse.status, 200)
  assert.equal(JSON.parse(auditResponse.body).mode, 'code-audit')

  const run = await runtime.auditStart({ targetPath: '/tmp/example', authorization: 'test' }, { sessionId: 'audit' })
  await runtime.auditAddApi({ runId: run.id, entryId: 'GET /admin', entryType: 'http', method: 'GET', path: '/admin', handler: 'adminHandler' }, { sessionId: 'audit' })
  await runtime.auditAddCandidate({ runId: run.id, candidateId: 'auth-bypass', title: '认证绕过', status: 'confirmed', entryId: 'GET /admin', entry: 'GET /admin', source: ['adminHandler input'], sink: ['authorization check'], evidence: ['internal/admin.go:42'], evidenceLocations: [{ file: 'internal/admin.go', line: 42, role: 'source' }], impact: '未授权访问管理接口', cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }, { sessionId: 'audit' })
  const report = await runtime.auditReport({ runId: run.id, title: '示例报告', markdown: '# 示例报告\n\n已验证。' }, { sessionId: 'audit' })

  const securityExec = { sessionId: 'secret', agent: { session: securitySession }, approval: { request: async () => 'allowed-session' } }
  await runtime.start({ target: 'https://offline-target.invalid:8443', objective: 'DNS 诊断', authorization: 'test scope' }, securityExec)
  await runtime.report({ target: 'offline-target.invalid:8443', title: 'DNS 诊断', markdown: '# DNS 诊断\n\n本地解析器不可用。' }, securityExec)
  const reportsResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/reports?sessionId=secret', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'secret' } }, reportsResponse)
  assert.equal(reportsResponse.status, 200)
  assert.match(JSON.parse(reportsResponse.body).reports[0].markdown, /DNS 诊断/)

  const referencesResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/reference/candidates?sessionId=secret&query=', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'secret' } }, referencesResponse)
  assert.equal(referencesResponse.status, 200)
  const references = JSON.parse(referencesResponse.body).candidates
  assert.ok(references.some(item => item.kind === 'session' && item.sessionId === 'audit'))
  assert.ok(references.some(item => item.kind === 'report' && item.reportId === report.id))

  const contentResponse = responseCapture()
  await route.handler({ method: 'GET', url: `/api/dsh-security/reference/content?sessionId=secret&kind=report&sourceSessionId=audit&reportId=${encodeURIComponent(report.id)}`, headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'secret' } }, contentResponse)
  assert.equal(contentResponse.status, 200)
  assert.match(JSON.parse(contentResponse.body).text, /示例报告/)

  const deniedReferenceResponse = responseCapture()
  await route.handler({ method: 'GET', url: '/api/dsh-security/reference/content?sessionId=secret&kind=session&sourceSessionId=secret', headers: { 'x-dsh-security-token': token, 'x-dsh-security-session-id': 'secret' } }, deniedReferenceResponse)
  assert.equal(deniedReferenceResponse.status, 400)
})
