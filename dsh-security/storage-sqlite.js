import Schema from '@deepseek-ai/schemastery'
import { StorageError, UNIT_NAME_RE, storageBackendServiceKey } from '@deepseek-ai/dsh-storage'
import { DatabaseSync } from 'node:sqlite'
import { chmod, mkdir, open } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

export const name = 'dsh-security-storage-sqlite'
export const inject = ['storage']
export const Config = Schema.object({ path: Schema.string().required(), journalMode: Schema.union(['wal', 'delete', 'truncate', 'persist']).default('wal') })

async function openDatabase(path, journalMode) {
  const actual = path === ':memory:' ? path : resolve(path)
  if (actual !== ':memory:') { await mkdir(dirname(actual), { recursive: true, mode: 0o700 }); try { await (await open(actual, 'wx', 0o600)).close() } catch (error) { if (error.code !== 'EEXIST') throw error } await chmod(actual, 0o600) }
  const db = new DatabaseSync(actual)
  try {
    db.exec('PRAGMA foreign_keys = ON'); db.exec(`PRAGMA journal_mode = ${journalMode.toUpperCase()}`)
    const version = db.prepare('PRAGMA user_version').get().user_version
    if (version !== 0 && version !== 1) throw new StorageError('version-mismatch', `security sqlite schema version ${version} is not supported`)
    db.exec('CREATE TABLE IF NOT EXISTS units (name TEXT PRIMARY KEY, version INTEGER NOT NULL) STRICT')
    db.exec('CREATE TABLE IF NOT EXISTS unit_globals (unit TEXT PRIMARY KEY REFERENCES units(name), value TEXT NOT NULL) STRICT')
    if (version === 0) db.exec('PRAGMA user_version = 1')
    return db
  } catch (error) { db.close(); throw error }
}

function tableName(unit, table) { return `u_${unit}_${table}` }

class SqliteUnit {
  constructor(db, descriptor, onClose) {
    this.db = db; this.descriptor = descriptor; this.onClose = onClose; this.closed = false; this.tables = new Map()
    for (const table of descriptor.tables) { const physical = tableName(descriptor.name, table); this.tables.set(table, { upsert: db.prepare(`INSERT INTO "${physical}" (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`), remove: db.prepare(`DELETE FROM "${physical}" WHERE key=?`), all: db.prepare(`SELECT key,value FROM "${physical}"`) }) }
    this.globalUpsert = descriptor.hasGlobal ? db.prepare('INSERT INTO unit_globals (unit,value) VALUES (?,?) ON CONFLICT(unit) DO UPDATE SET value=excluded.value') : undefined
    this.globalSelect = descriptor.hasGlobal ? db.prepare('SELECT value FROM unit_globals WHERE unit=?') : undefined
  }
  ensureOpen() { if (this.closed) throw new StorageError('closed', `kv unit '${this.descriptor.name}' is closed`) }
  run(fn) { try { this.ensureOpen(); return Promise.resolve(fn()) } catch (error) { return Promise.reject(error) } }
  parse(value) { try { return JSON.parse(value) } catch (error) { throw new StorageError('malformed-medium', `invalid JSON in '${this.descriptor.name}'`, { cause: error }) } }
  loadAll() { return this.run(() => { const tables = {}; for (const [name, statements] of this.tables) { const rows = {}; for (const row of statements.all.all()) rows[row.key] = this.parse(row.value); tables[name] = rows } let global = null; if (this.globalSelect) { const row = this.globalSelect.get(this.descriptor.name); if (row) global = this.parse(row.value) } return { tables, global } }) }
  putRecord(table, key, value) { return this.run(() => this.tables.get(table).upsert.run(key, JSON.stringify(value))) }
  deleteRecord(table, key) { return this.run(() => this.tables.get(table).remove.run(key)) }
  setGlobal(value) { return this.run(() => { if (!this.globalUpsert) throw new Error('unit has no global'); this.globalUpsert.run(this.descriptor.name, JSON.stringify(value)) }) }
  close() { if (!this.closed) { this.closed = true; this.onClose() } return Promise.resolve() }
}

export class SqliteBackend {
  constructor(config) { this.kv = { open: descriptor => this.openUnit(descriptor) }; this.ready = openDatabase(config.path, config.journalMode); this.ready.catch(() => {}); this.units = new Map(); this.closing = undefined }
  openUnit(descriptor) {
    if (this.closing) return Promise.reject(new StorageError('closed', 'sqlite backend is closed'))
    if (!UNIT_NAME_RE.test(descriptor.name) || descriptor.tables.some(table => !UNIT_NAME_RE.test(table))) return Promise.reject(new Error('invalid storage unit name'))
    if (this.units.has(descriptor.name)) return Promise.reject(new Error(`storage unit '${descriptor.name}' is already open`))
    const pending = this.materialize(descriptor); this.units.set(descriptor.name, pending); pending.catch(() => this.units.delete(descriptor.name)); return pending
  }
  async materialize(descriptor) {
    const db = await this.ready; const row = db.prepare('SELECT version FROM units WHERE name=?').get(descriptor.name)
    if (!row) db.prepare('INSERT INTO units (name,version) VALUES (?,?)').run(descriptor.name, descriptor.version); else if (row.version !== descriptor.version) throw new StorageError('version-mismatch', `unit '${descriptor.name}' version mismatch`)
    for (const table of descriptor.tables) db.exec(`CREATE TABLE IF NOT EXISTS "${tableName(descriptor.name, table)}" (key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT`)
    return new SqliteUnit(db, descriptor, () => this.units.delete(descriptor.name))
  }
  async close() { if (this.closing) return this.closing; this.closing = (async () => { let db; try { db = await this.ready } catch { return } for (const pending of this.units.values()) await (await pending.catch(() => undefined))?.close(); db.close() })(); return this.closing }
}

export function apply(ctx, config) {
  const backend = new SqliteBackend(config)
  ctx.effect(() => { const dispose = ctx.storage.backend.register('sqlite', backend); return async () => { dispose(); await backend.close() } }, 'dsh-security-storage-sqlite: backend')
  ctx.provide(storageBackendServiceKey('sqlite'), backend)
}
