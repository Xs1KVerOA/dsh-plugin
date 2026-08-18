import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

test('single resource-center bundle registers workspace, service-management, and Test Activities', async () => {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  assert.match(source, /key: pane\.id/, 'service panes must remount when switching connections')
  assert.match(source, /__dshResourceCenterServiceManagerRegistered/, 'service-manager registration must be idempotent during HMR')
  assert.match(source, /DEFAULT_RESULT_LIMIT = 10/, 'data browsers must default to the first ten rows')
  assert.match(source, /--dsh-sidebar-width/, 'workspace and service layouts must share the host sidebar width')
  assert.match(source, /syncHostLayoutMetrics/, 'host sidebar metrics must be measured at runtime')
  assert.match(source, /data-dsh-sidebar-collapsed/, 'resource center must react to the host sidebar collapsed state')
  assert.match(source, /drc-dock\.drc-open\{top:0;height:100vh/, 'collapsed host sidebars must not leave a blank top area')
  assert.match(source, /drc-dock\.drc-open \.drc-rail-button\{pointer-events:auto/, 'collapsed host rail controls must remain interactive')
  assert.match(source, /function SshOverview/, 'SSH connections must expose a server overview')
  assert.match(source, /params: \{ op: 'inspect' \}/, 'SSH overview must use the inspect operation')
  assert.match(source, /setInterval\(tick, 10_000\)/, 'SSH overview must refresh periodically')
  assert.match(source, /inspectInFlight/, 'SSH overview polling must avoid overlapping SSH requests')
  assert.match(source, /function ServiceOverview/, 'non-SSH services must expose a shared overview')
  assert.match(source, /不会修改远端数据/, 'service overview must remain read-only')
  assert.match(source, /function SshFileManager/, 'SSH must use a dedicated file workspace')
  assert.match(source, /function SshTerminalPanel/, 'SSH must expose a dedicated interactive terminal')
  assert.match(source, /terminalIdRef/, 'SSH terminal cleanup must not close the same terminal twice when state changes')
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
  assert.match(source, /databaseRequestRef/, 'database schema requests must ignore stale responses')
  assert.match(source, /collectionsRequestRef/, 'MongoDB collection requests must ignore stale responses')
  assert.match(source, /tablesRequestRef/, 'Cassandra table requests must ignore stale responses')
  assert.match(source, /valueRequestRef/, 'Redis value requests must ignore stale responses')
  assert.match(source, /dwt-tab/, 'Test module must expose MITM and Web Fuzzer tabs')
  assert.match(source, /dwt-center-pane-layer/, 'Test controls must render in the central content area')
  assert.match(source, /dwt-sidebar-panel/, 'Test activity should keep only compact navigation in the sidebar')
  assert.match(source, /dwt-sidebar-fuzzer-config/, 'Web Fuzzer configuration must live in the Test sidebar')
  assert.match(source, /function TestCenterPane/, 'Test activity must provide a central tool pane')
  assert.match(source, /function FuzzerInstanceTabs/, 'Web Fuzzer should support multiple open instances')
  assert.match(source, /dwt-fuzzer-instance-tabs\{[^}]*border-bottom/, 'Web Fuzzer instance tabs should be placed above the workbench')
  assert.match(source, /const \[history, setHistory\] = React\.useState\(\(\) => testReferenceState\.history \|\| \[\]\)/, 'Test should own one shared history store for all Fuzzer instances')
  assert.match(source, /useFuzzerState\(\{ history, setHistory \}, activeFuzzer\)/, 'Fuzzer state should use the shared Test history store')
  assert.match(source, /instanceLabel: historyInstanceLabel/, 'History entries should retain their source Fuzzer instance')
  assert.match(source, /新建 Web Fuzzer/, 'Web Fuzzer should provide an add-instance action')
  assert.match(source, /dwt-fuzzer-workbench-central/, 'Web Fuzzer central pane should contain only request and response')
  assert.match(source, /dwt-fuzzer-sidebar-hero/, 'Web Fuzzer sidebar should have a structured visual header')
  assert.match(source, /TEST WORKBENCH/, 'Web Fuzzer sidebar should expose its workbench identity')
  assert.match(source, /dwt-fuzzer-toolbar-status/, 'Web Fuzzer toolbar should expose execution status')
  assert.match(source, /dwt-fuzzer-toolbar-context/, 'Web Fuzzer toolbar should describe the current request workspace')
  assert.match(source, /dwt-fuzzer-run/, 'Web Fuzzer execution should be placed in the Request pane')
  assert.match(source, /dwt-fuzzer-pane-mark/, 'Request and Response panes should have visual markers')
  assert.match(source, /dwt-fuzzer-empty-icon/, 'Web Fuzzer empty states should guide the next action')
  assert.match(source, /dwt-fuzzer-instance-label/, 'Web Fuzzer instance tabs should identify their purpose')
  assert.match(source, /dwt-config-section/, 'Web Fuzzer should keep execution settings in structured sections')
  assert.match(source, /网络配置/, 'Web Fuzzer should expose network settings in the sidebar')
  assert.match(source, /代理地址/, 'Web Fuzzer should expose proxy configuration')
  assert.match(source, /CA 证书（PEM）/, 'Web Fuzzer should expose custom CA configuration')
  assert.match(source, /客户端私钥（PEM）/, 'Web Fuzzer should expose mTLS private-key configuration')
  assert.match(source, /启用 HTTPS 劫持 \/ MITM/, 'Web Fuzzer should expose HTTPS interception configuration')
  assert.match(source, /dwt-fuzzer-request/, 'Web Fuzzer should expose a Request editor pane')
  assert.match(source, /dwt-fuzzer-response/, 'Web Fuzzer should expose a Response/result pane')
  assert.match(source, /function responsePacket/, 'Web Fuzzer should render a concrete response packet')
  assert.doesNotMatch(source, /断言配置/, 'Web Fuzzer should not expose assertion settings in the left sidebar')
  assert.match(source, /搜索响应包/, 'Web Fuzzer Response should provide response-packet search')
  assert.match(source, /function HighlightedText/, 'Web Fuzzer Response search should highlight matching content')
  assert.match(source, /响应筛选/, 'Dictionary-backed Fuzzer results should provide Response filters')
  assert.match(source, /dwt-fuzzer-result-header/, 'Dictionary-backed Fuzzer results should expose tabular fields')
  assert.match(source, /function FuzzerHistoryPanel/, 'Web Fuzzer should expose request history')
  assert.match(source, /搜索请求、URL、Body/, 'Web Fuzzer history should search request content')
  assert.match(source, /function ConfirmDialog/, 'destructive Test actions should use a shared confirmation dialog')
  assert.match(source, /重置 Web Fuzzer？/, 'resetting Web Fuzzer should require confirmation')
  assert.match(source, /清空请求模板？/, 'clearing the Fuzzer request should require confirmation')
  assert.match(source, /清空 Fuzz 结果？/, 'clearing Fuzzer results should require confirmation')
  assert.match(source, /清空全部请求历史？/, 'clearing shared Fuzzer history should require confirmation')
  assert.match(source, /清空全部 MITM 流量？/, 'clearing MITM flows should require confirmation')
  assert.match(source, /extractHistory/, 'Web Fuzzer history should extract a request into the editor')
  assert.match(source, /replayHistory/, 'Web Fuzzer history should replay a request')
  assert.match(source, /status: 'running'/, 'Every Fuzzer execution should create a history entry before completion')
  assert.match(source, /function formatRawHttp/, 'Web Fuzzer should support raw HTTP formatting')
  assert.match(source, /flow\/\$\{encodeURIComponent\(item\.flowId\)\}/, 'Web Fuzzer results should load captured response details')
  assert.match(source, /name: '会话'/, 'the @ menu should expose conversation references')
  assert.match(source, /name: 'Web Fuzzer'/, 'the @ menu should expose Web Fuzzer history references')
  assert.match(source, /name: 'MITM'/, 'the @ menu should expose MITM history references')
  assert.match(source, /source: 'Web Fuzzer'/, 'Web Fuzzer references should keep a serializable source identity')
  assert.match(source, /source: 'MITM'/, 'MITM references should keep a serializable source identity')
  assert.match(source, /function MitmConfigSidebar/, 'MITM proxy and configuration must live in the sidebar')
  assert.match(source, /dwt-mitm-sidebar/, 'MITM configuration should use an independent flex sidebar container')
  assert.match(source, /dwt-mitm-status-card/, 'MITM sidebar should expose a structured proxy status card')
  assert.match(source, /dwt-mitm-hero/, 'MITM sidebar should share the Web Fuzzer workbench hierarchy')
  assert.match(source, /当前运行端点/, 'MITM should distinguish the active endpoint from the configured port')
  assert.match(source, /启动端口/, 'MITM should label the configured port as the next startup port')
  assert.match(source, /0 = 自动分配/, 'MITM should explain the automatic port behavior')
  assert.match(source, /TRAFFIC INSPECTOR/, 'MITM traffic should have a visual toolbar identity')
  assert.match(source, /等待流量进入/, 'MITM empty state should guide the next action')
  assert.match(source, /手动劫持/, 'MITM should expose manual interception')
  assert.match(source, /自动放行规则/, 'MITM should expose automatic release rules')
  assert.match(source, /指定路由/, 'MITM should support route interception filters')
  assert.match(source, /只匹配后缀/, 'MITM should support suffix interception filters')
  assert.match(source, /HaE 敏感数据/, 'MITM should expose HaE sensitive-data extraction settings')
  assert.match(source, /载入常用规则/, 'MITM should expose reusable HaE rule presets')
  assert.match(source, /flags 自动补全 g/, 'MITM HaE settings should explain global matching behavior')
  assert.match(source, /function MitmPanel/, 'MITM should render a central traffic panel')
  assert.match(source, /function mitmRequestToRaw/, 'MITM requests should be convertible to raw HTTP for Fuzzer')
  assert.match(source, /发送到 Web Fuzzer/, 'MITM flow details should expose a Fuzzer handoff action')
  assert.match(source, /sendMitmToFuzzer/, 'MITM should create a Fuzzer instance from a selected flow')
  assert.match(source, /setTab\('fuzzer'\)/, 'MITM handoff should switch to the Web Fuzzer tab')
  assert.match(source, /dwt-mitm-table/, 'MITM should render captured traffic as a table')
  assert.match(source, /替换并放行/, 'MITM should support replacing and releasing responses')
  assert.match(source, /flowAction/, 'MITM should expose per-flow actions')
  assert.match(source, /HTTPS CONNECT 目前为透传/, 'MITM UI should state the built-in HTTPS limitation')
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
  assert.equal(JSON.stringify(ctx.sidebar.getActivities().map(activity => activity.id)), JSON.stringify(['workspace', 'dsh-service-manage', 'test']))
  assert.equal(typeof ctx.sidebar.getActivities()[1].component, 'function')
  assert.equal(typeof ctx.sidebar.getActivities()[2].component, 'function')
  assert.deepEqual(sources.map(source => source.name), ['会话', '服务连接', 'Web Fuzzer', 'MITM'])
  for (const dispose of disposers) dispose?.()
  assert.equal(JSON.stringify(ctx.sidebar.getActivities().map(activity => activity.id)), JSON.stringify(['workspace']))
  assert.equal(sources.length, 0)
})
