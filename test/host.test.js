import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'
import { parseSshInspectOutput } from '../service-manager-host.js'

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
  const tools = []
  const guards = []
  const effects = []
  const toolService = {
    register(tool) { tools.push(tool) },
    guard(guard) { guards.push(guard) },
  }
  const ctx = {
    tools: toolService,
    get(name) {
      if (name === 'webServer') return { register(route) { routes.push(route); return () => {} } }
      if (name === 'sessions') return { get() { return undefined } }
      if (name === 'sessionTitle') return undefined
      if (name === 'credentials') return {}
      if (name === 'fs') return {}
      if (name === 'tools') return toolService
      if (name === 'sandboxPolicy') return { workspaceRoot: '/tmp' }
      return undefined
    },
    effect(factory) { effects.push(factory()) },
  }
  apply(ctx)
  assert.deepEqual(routes.map(route => route.path), [
    '/api/dsh-resource-center/rename-session',
    '/api/dsh-resource-center/search-sessions',
    '/api/dsh-service-manage',
  ])
  assert.deepEqual(tools.map(tool => tool.name), ['dsh_server_manage'])
  assert.equal(guards.length, 1)
  assert.match(String(guards[0]({ name: 'bash', arguments: { command: 'ssh user@example.com' } })), /dsh_server_manage/)
  assert.equal(guards[0]({ name: 'bash', arguments: { command: 'pwd' } }), undefined)
  assert.equal(effects.length, 4)
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
