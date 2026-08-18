import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { SqliteBackend } from '../storage-sqlite.js'

test('SQLite backend persists storage-domain records', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-security-'))
  const backend = new SqliteBackend({ path: join(directory, 'security.db'), journalMode: 'delete' })
  t.after(async () => { await backend.close(); await rm(directory, { recursive: true, force: true }) })
  const descriptor = { name: 'security', version: 1, tables: ['goals'], hasGlobal: false }
  const unit = await backend.kv.open(descriptor)
  await unit.putRecord('goals', 'session:goal-1', { sessionId: 'session', target: 'https://example.com' })
  const loaded = await unit.loadAll()
  assert.deepEqual(loaded.tables.goals['session:goal-1'], { sessionId: 'session', target: 'https://example.com' })
  await unit.deleteRecord('goals', 'session:goal-1')
  assert.deepEqual((await unit.loadAll()).tables.goals, {})
})
