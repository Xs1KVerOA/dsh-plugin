import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('single resource-center bundle registers workspace and service-management Activities', async () => {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(source, /key: pane\.id/, 'service panes must remount when switching connections')
  assert.match(source, /__dshResourceCenterServiceManagerRegistered/, 'service-manager registration must be idempotent during HMR')
  assert.match(source, /DEFAULT_RESULT_LIMIT = 10/, 'data browsers must default to the first ten rows')
  assert.match(source, /--dsh-sidebar-width/, 'workspace and service layouts must share the host sidebar width')
  assert.match(source, /syncHostLayoutMetrics/, 'host sidebar metrics must be measured at runtime')
  assert.match(source, /function SshOverview/, 'SSH connections must expose a server overview')
  assert.match(source, /params: \{ op: 'inspect' \}/, 'SSH overview must use the inspect operation')
  assert.match(source, /setInterval\(tick, 10_000\)/, 'SSH overview must refresh periodically')
  assert.match(source, /inspectInFlight/, 'SSH overview polling must avoid overlapping SSH requests')
  assert.match(source, /function ServiceOverview/, 'non-SSH services must expose a shared overview')
  assert.match(source, /不会修改远端数据/, 'service overview must remain read-only')
  assert.match(source, /function SshFileManager/, 'SSH must use a dedicated file workspace')
  assert.match(source, /function SshTerminalPanel/, 'SSH must expose a dedicated interactive terminal')
  assert.match(source, /dsm-ssh-context-menu/, 'SSH files must expose a context menu')
  assert.match(source, /op: 'downloadFile'/, 'SSH files must support downloads')
  assert.match(source, /op: 'uploadFile'/, 'SSH files must support uploads')
  assert.match(source, /op: 'writeFile'/, 'SSH editor must save through SFTP')
  assert.match(source, /directoryCacheRef/, 'SSH directory listings should be cached between tree navigation')
  assert.match(source, /directoryPendingRef/, 'SSH directory requests should be deduplicated')
  assert.match(source, /fileCacheRef/, 'SSH file contents should be cached between editor opens')
  assert.match(source, /linear-gradient\(180deg,#3c83ee,#3578e5\)/, 'buttons should use the compact polished visual treatment')
  assert.match(source, /\.dsm-embedded-panel \.dsm-list\{max-height:none/, 'embedded service lists should fill the sidebar before the footer hint')
  assert.match(source, /\.dsm-embedded-panel \.dsm-list>\.dsm-help\{flex:0 0 auto;margin: auto/, 'service hint divider should be pinned to the sidebar bottom')
  assert.match(source, /\.dsm-embedded-panel \.dsm-card-icon\{width:30px;height:30px/, 'embedded service icons should stay compact')
  assert.match(source, /\.dsm-embedded-panel \.dsm-card\{gap:8px;min-height:0/, 'embedded service cards should use compact rows')
  assert.match(source, /\.dsm-embedded-panel \.dsm-head \.dsm-sub\{flex:0 0 auto;white-space:nowrap/, 'embedded service header badges should not wrap into the title row')
  assert.match(source, /\.dsm-embedded-panel \.dsm-head\{gap:4px;padding:0 8px/, 'embedded service headers should use the narrow sidebar width efficiently')
  assert.match(source, /createRemote\('mkdir'\)/, 'SSH file manager must support new folders')
  assert.match(source, /createRemote\('createFile'\)/, 'SSH file manager must support new files')
  const definitions = new Map()
  const cache = new Map()
  const sources = []
  const disposers = []
  const style = { dataset: {}, textContent: '', remove() {} }
  const document = {
    querySelector() { return null },
    createElement() { return style },
    head: { appendChild() {} },
  }
  const React = { createElement: (...args) => ({ args }) }
  const window = { __ModuleLoader__: { load(input) { definitions.set(input.id, input) } } }
  const sandbox = { document, window, React, console }
  vm.runInNewContext(source, sandbox, { filename: 'dsh-resource-center/client.js' })

  const materialize = id => {
    if (cache.has(id)) return cache.get(id)
    const definition = definitions.get(id)
    assert.ok(definition, `missing client definition: ${id}`)
    const value = definition.factory(name => name === 'react' ? React : materialize(name))
    cache.set(id, value)
    return value
  }
  const module = materialize('dsh-resource-center')
  const ctx = {
    provide(name, value) {
      if (name === 'resourceCenter') this.sidebar = value
    },
    get(name) {
      if (name === 'resourceCenter') return this.sidebar
      if (name === 'inputTriggers') return { registerSource(source) { sources.push(source); return () => sources.splice(sources.indexOf(source), 1) } }
      if (name === 'sessions') return {}
      if (name === 'workspaces') return {}
      return undefined
    },
    effect(factory) { disposers.push(factory()) },
    slots: { inject() {}, register() { return () => {} } },
  }
  module.apply(ctx)
  assert.deepEqual(Array.from(module.inject), ['slots', 'sessions', 'workspaces', 'inputTriggers'])
  assert.ok(ctx.sidebar)
  assert.equal(ctx.sidebar.getActive(), 'workspace')
  assert.equal(JSON.stringify(ctx.sidebar.getActivities().map(activity => activity.id)), JSON.stringify(['workspace', 'dsh-service-manage']))
  assert.equal(typeof ctx.sidebar.getActivities()[1].component, 'function')
  assert.equal(sources.length, 1)
  for (const dispose of disposers) dispose?.()
  assert.equal(JSON.stringify(ctx.sidebar.getActivities().map(activity => activity.id)), JSON.stringify(['workspace']))
  assert.equal(sources.length, 0)
})
