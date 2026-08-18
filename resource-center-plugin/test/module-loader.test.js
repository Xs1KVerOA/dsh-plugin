import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function loadDefinitions(selectedModules) {
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')
  const definitions = new Map()
  const window = {
    ...(selectedModules ? { __DSH_RESOURCE_CENTER_MODULES: selectedModules } : {}),
    __ModuleLoader__: { load(input) { definitions.set(input.id, input) } },
  }
  vm.runInNewContext(source, { window, console }, { filename: 'dsh-resource-center/client.js' })
  return definitions
}

test('client entry loads the default sidebar modules', async () => {
  const definitions = await loadDefinitions()
  assert.deepEqual([...definitions.keys()], [
    'dsh-resource-center',
    'dsh-resource-center-service-manager',
    'dsh-resource-center-test',
    'dsh-resource-center-usage-stats',
    'dsh-resource-center-right-sidebar',
  ])
})

test('client entry can load only the workspace module', async () => {
  const definitions = await loadDefinitions(['workspace'])
  assert.deepEqual([...definitions.keys()], ['dsh-resource-center'])
})

test('client entry loads workspace as a dependency of service-manager', async () => {
  const definitions = await loadDefinitions(['serviceManager'])
  assert.deepEqual([...definitions.keys()], [
    'dsh-resource-center',
    'dsh-resource-center-service-manager',
  ])
})

test('client entry loads workspace as a dependency of the Test module', async () => {
  const definitions = await loadDefinitions(['test'])
  assert.deepEqual([...definitions.keys()], [
    'dsh-resource-center',
    'dsh-resource-center-test',
  ])
})

test('client entry loads workspace as a dependency of the right sidebar bridge', async () => {
  const definitions = await loadDefinitions(['rightSidebar'])
  assert.deepEqual([...definitions.keys()], [
    'dsh-resource-center',
    'dsh-resource-center-right-sidebar',
  ])
})
