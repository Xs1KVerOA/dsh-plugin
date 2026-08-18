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
  snapshot = { current: 's1', byId: { s1: { agentPreset: 'standard' } } }
  sync()
  assert.deepEqual([...active.keys()], ['security-session-mode'])
  snapshot = { current: 's1', byId: { s1: { agentPreset: 'code-audit' } } }
  sync()
  assert.deepEqual([...active.keys()], ['security-session-mode', 'code-audit-apis', 'code-audit-reports'])
})
