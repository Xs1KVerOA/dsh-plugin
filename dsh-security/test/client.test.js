import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

test('registers security history and report conversation views', () => {
  const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  const entries = []
  const registrations = []
  const sources = []
  const active = new Map()
  let snapshot = { current: 's1', byId: { s1: { agentPreset: 'standard' } } }
  let sync
  const React = { createElement: (...args) => args, Fragment: Symbol('Fragment'), useState: initial => [initial, () => {}], useEffect: () => {}, useCallback: callback => callback, useRef: value => ({ current: value }) }
  const context = {
    __ModuleLoader__: {
      load(module) { entries.push(module); return module.factory(name => name === 'react' ? React : { MarkdownText: function MarkdownText() {} }) },
    },
  }
  vm.runInNewContext(source, context)
  const plugin = entries[0].factory(name => name === 'react' ? React : { MarkdownText: function MarkdownText() {} })
  const ctx = {
    effect(effect) { return typeof effect === 'function' ? effect() : undefined },
    inputTriggers: { registerSource(source) { sources.push(source); return () => {} } },
    sessions: {
      list: {
        getSnapshot() { return snapshot },
        subscribe(callback) { sync = callback; return () => {} },
      },
    },
    slots: {
      inject(name, callback) { assert.ok(['conversation.view', 'conversation.session.header.utilities'].includes(name)); callback() },
      register(definition, component) { registrations.push({ definition, component }); active.set(definition.id, component); return () => active.delete(definition.id) },
    },
  }
  plugin.apply(ctx)
  assert.deepEqual(sources.map(source => [source.trigger, source.name]), [['@', '安全审计']])
  const inserted = sources[0].onPick({ candidate: { name: '示例审计', hint: JSON.stringify({ kind: 'session', sessionId: 'audit' }) } })
  assert.equal(inserted.insert.source, 'dsh-security-audit')
  assert.equal(JSON.parse(inserted.insert.ref).sessionId, 'audit')
  assert.deepEqual(registrations.map(item => item.definition.id), ['security-session-mode'])
  assert.deepEqual([...active.keys()], ['security-session-mode'])
  let selectorCalled = false
  registrations[0].component({ sessionId: 's1', useSessions: selector => { selectorCalled = true; assert.equal(typeof selector, 'function'); return selector(snapshot) } })
  assert.equal(selectorCalled, true)
  snapshot = { current: 's1', byId: { s1: { agentPreset: 'security' } } }
  sync()
  assert.deepEqual([...active.keys()], ['security-session-mode', 'pentest-history', 'pentest-reports'])
  assert.deepEqual(registrations.map(item => item.definition.order), [-20, 20, 30])
  assert.match(source, /flow\?\.response\?\.status \?\? flow\?\.status/)
  assert.match(source, /historyStatusLabel\(flow\)/)
  assert.match(source, /typeof value === 'number'.*Number\(value\)/s)
  snapshot = { current: 's1', byId: { s1: { agentPreset: 'standard' } } }
  sync()
  assert.deepEqual([...active.keys()], ['security-session-mode'])
  snapshot = { current: 's1', byId: { s1: { agentPreset: 'code-audit' } } }
  sync()
  assert.deepEqual([...active.keys()], ['security-session-mode', 'code-audit-apis', 'code-audit-reports'])
})

test('renders the structured API inventory contract', () => {
  const source = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  for (const label of ['搜索路径或方法', '方法', '路径', '漏洞', '漏洞 ID', '存在漏洞', '未发现漏洞']) assert.match(source, new RegExp(label))
  for (const removed of ['来源置信度', 'AI 鉴权结论', '审计覆盖', '关联风险', '审计域', '入口详情']) assert.doesNotMatch(source, new RegExp(removed))
  assert.match(source, /dsec-api-search/)
  assert.match(source, /dsec-api-method/)
  assert.match(source, /item\.handler/)
  assert.match(source, /dsec-api-secondary/)
  assert.match(source, /dsec-badge-good/)
  assert.match(source, /API 覆盖率/)
  assert.match(source, /displayAuditSummary/)
  assert.doesNotMatch(source, /待复核项.*CandidateGroup/)
  assert.match(source, /dsec-report-section/)
  assert.match(source, /dsec-coverage-fill/)
  assert.match(source, /dsec-report-impact/)
  assert.match(source, /dsec-coverage-entry/)
  assert.match(source, /dsec-summary-card-critical/)
  assert.match(source, /dsec-summary-card-high/)
  assert.match(source, /dsec-summary-card-medium/)
  assert.match(source, /dsec-finding-critical/)
  assert.match(source, /auditSeverityClass/)
  assert.match(source, /vulnerabilityIds/)
  assert.match(source, /focusAuditFinding/)
  assert.match(source, /auditFindingAnchor/)
  assert.match(source, /dsec-report-poc/)
  assert.match(source, /Request PoC（未执行）/)
  for (const label of ['调用链路', '受影响文件', '修复建议', 'dsec-finding-api', 'dsec-finding-cvss']) assert.match(source, new RegExp(label))
})

test('keeps DSH code-audit mode independent from local deep-audit skill stages', () => {
  const files = [
    new URL('../audit-tools.js', import.meta.url),
    new URL('../presets/code-audit/agent.cordis.yml', import.meta.url),
    new URL('../presets/code-audit/preset.yml', import.meta.url),
  ].map(url => fs.readFileSync(url, 'utf8')).join('\n')
  assert.match(files, /dsh_code_audit_mark_api_reviewed/)
  assert.match(files, /每个 API 分析结束后必须调用 dsh_code_audit_mark_api_reviewed/)
  assert.match(files, /不要归一化或合并记录/)
  assert.doesNotMatch(files, /L0\.5|L1\.5|code-review-graph|queue worker|verifier|深度审计/)
})
