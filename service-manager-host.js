import { randomInt } from 'node:crypto'
import { Agent as HttpsAgent } from 'node:https'
import { createServer } from 'node:net'
import { PassThrough, Readable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'
import { URL } from 'node:url'

import { DeleteObjectCommand, GetObjectCommand, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Client as ElasticsearchClient } from '@elastic/elasticsearch'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { Client as FtpClient } from 'basic-ftp'
import cassandra from 'cassandra-driver'
import Docker from 'dockerode'
import mssql from 'mssql'
import { MongoClient } from 'mongodb'
import mysql from 'mysql2/promise'
import { Client as PgClient } from 'pg'
import { createClient as createRedisClient } from 'redis'
import { SocksClient } from 'socks'
import ssh2 from 'ssh2'
import { defineTool } from '@deepseek-ai/dsh-tools'

const { Client: SSHClient } = ssh2
const { Client: CassandraClient, auth: cassandraAuth } = cassandra

const SECRET_FIELDS = ['password', 'privateKey', 'accessKey', 'secretKey', 'token', 'proxyPassword', 'proxyKey']

export const name = 'dsh-service-manage'
export const inject = ['webServer', 'credentials', 'fs', 'tools']

export const TYPES = Object.freeze({
  ssh: { label: 'SSH', port: 22 },
  ftp: { label: 'FTP', port: 21 },
  redis: { label: 'Redis', port: 6379 },
  mysql: { label: 'MySQL', port: 3306 },
  mariadb: { label: 'MariaDB', port: 3306 },
  postgresql: { label: 'PostgreSQL', port: 5432 },
  mssql: { label: 'SQL Server', port: 1433 },
  elasticsearch: { label: 'Elasticsearch', port: 9200 },
  docker: { label: 'Docker', port: 0 },
  mongodb: { label: 'MongoDB', port: 27017 },
  cassandra: { label: 'Cassandra', port: 9042 },
  s3: { label: 'S3 / MinIO / R2', port: 0 },
})

const TYPE_ALIASES = Object.freeze({ postgres: 'postgresql', postsql: 'postgresql', elastic: 'elasticsearch', es: 'elasticsearch' })
const PROXY_TYPES = new Set(['none', 'ssh', 'tcp', 'socks5'])
const COMPATIBILITY_MODES = new Set(['auto', 'legacy', 'modern'])
const SAFE_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const SERVICE_TOOL_OPERATIONS = Object.freeze([
  'test', 'query', 'info', 'inspect',
  'listFiles', 'readFile', 'writeFile', 'deleteFile', 'downloadFile', 'uploadFile', 'mkdir', 'createFile', 'renameFile',
  'listDatabases', 'listTables', 'tableData',
  'listKeys', 'getKey', 'setKey', 'delKey',
  'listIndices',
  'listContainers', 'listImages', 'logs', 'start', 'stop', 'exec',
  'listCollections', 'find',
  'listKeyspaces',
  'listBuckets', 'listObjects', 'readObject', 'writeObject', 'deleteObject',
  'terminalOpen', 'terminalRead', 'terminalWrite', 'terminalResize', 'terminalClose',
])
const SERVICE_TOOL_OPERATION_SET = new Set(SERVICE_TOOL_OPERATIONS)
const REMOTE_SHELL_FALLBACK_PATTERN = /(?:^|[;&|]\s*)(?:env\s+)?(?:sshpass|ssh|sftp|scp|rsync|mysql|mariadb|psql|redis-cli|mongosh|mongo|cqlsh|sqlcmd|docker|ftp|curl|wget|aws|s5cmd)\b|\b(?:paramiko|asyncssh|fabric|ssh2)\b|(?:~\/|\$HOME\/)(?:\.ssh(?:\/|\b)|\.dsh(?:\/|\b))/i

const SSH_INSPECT_COMMAND = String.raw`
printf "__DSH_HOST__\t%s\n" "$(hostname 2>/dev/null || printf unknown)"
os_name=$(sed -n 's/^PRETTY_NAME=//p' /etc/os-release 2>/dev/null | head -n 1 | sed 's/^"//;s/"$//')
[ -n "$os_name" ] || os_name=$(uname -s 2>/dev/null || printf unknown)
printf "__DSH_OS__\t%s\n" "$os_name"
printf "__DSH_KERNEL__\t%s\n" "$(uname -srmo 2>/dev/null || uname -a 2>/dev/null || printf unknown)"
printf "__DSH_UPTIME__\t%s\n" "$(uptime 2>/dev/null | sed 's/^[[:space:]]*//' || printf unknown)"
cores=$(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || printf 0)
printf "__DSH_CPU_CORES__\t%s\n" "$cores"
load=$(cut -d' ' -f1-3 /proc/loadavg 2>/dev/null)
[ -n "$load" ] || load=$(sysctl -n vm.loadavg 2>/dev/null | tr -d '{}')
[ -n "$load" ] || load=$(uptime 2>/dev/null | sed 's/.*load averages*[：:][[:space:]]*//')
printf "__DSH_CPU_LOAD__\t%s\n" "$load"
if [ -r /proc/meminfo ]; then
  awk '/^MemTotal:/ {t=$2*1024} /^MemAvailable:/ {a=$2*1024} END {printf "__DSH_MEMORY__\t%.0f\t%.0f\t%.0f\n", t, t-a, a}' /proc/meminfo
elif command -v vm_stat >/dev/null 2>&1; then
  pagesize=$(sysctl -n hw.pagesize 2>/dev/null || printf 4096)
  total=$(sysctl -n hw.memsize 2>/dev/null || printf 0)
  free=$(vm_stat | awk '/Pages free/ {gsub("\\.", "", $3); print $3}')
  inactive=$(vm_stat | awk '/Pages inactive/ {gsub("\\.", "", $3); print $3}')
  [ -n "$free" ] || free=0
  [ -n "$inactive" ] || inactive=0
  available=$(( (free + inactive) * pagesize ))
  used=$((total-available))
  printf "__DSH_MEMORY__\t%s\t%s\t%s\n" "$total" "$used" "$available"
else
  printf "__DSH_MEMORY__\t0\t0\t0\n"
fi
if command -v df >/dev/null 2>&1; then
  df -Pk / 2>/dev/null | awk 'NR==2 {printf "__DSH_DISK__\t%.0f\t%.0f\t%s\n", $2*1024, $3*1024, $5}'
fi
printf "__DSH_PORTS__\n"
if command -v ss >/dev/null 2>&1; then
  ss -lnt 2>/dev/null | awk 'NR>1 {print $4}'
elif command -v netstat >/dev/null 2>&1; then
  netstat -lnt 2>/dev/null | awk 'NR>2 {print $4}'
fi | sed 's/.*://' | sort -n | uniq | while IFS= read -r port; do
  [ -n "$port" ] && printf "__DSH_PORT__\t%s\n" "$port"
done
printf "__DSH_END__\n"
`

export function parseSshInspectOutput(text) {
  const numeric = value => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const snapshot = {
    host: '',
    os: '',
    kernel: '',
    uptime: '',
    cpu: { cores: 0, load: '' },
    memory: { totalBytes: 0, usedBytes: 0, availableBytes: 0 },
    disk: { totalBytes: 0, usedBytes: 0, usagePercent: '' },
    ports: [],
  }
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const [key, ...parts] = line.split('\t')
    const value = parts.join('\t').trim()
    if (key === '__DSH_HOST__') snapshot.host = value
    else if (key === '__DSH_OS__') snapshot.os = value
    else if (key === '__DSH_KERNEL__') snapshot.kernel = value
    else if (key === '__DSH_UPTIME__') snapshot.uptime = value
    else if (key === '__DSH_CPU_CORES__') snapshot.cpu.cores = numeric(value)
    else if (key === '__DSH_CPU_LOAD__') snapshot.cpu.load = value
    else if (key === '__DSH_MEMORY__') {
      snapshot.memory = { totalBytes: numeric(parts[0]), usedBytes: numeric(parts[1]), availableBytes: numeric(parts[2]) }
    } else if (key === '__DSH_DISK__') {
      snapshot.disk = { totalBytes: numeric(parts[0]), usedBytes: numeric(parts[1]), usagePercent: String(parts[2] || '').trim() }
    } else if (key === '__DSH_PORT__' && value) snapshot.ports.push(value)
  }
  snapshot.ports = [...new Set(snapshot.ports)].sort((left, right) => numeric(left) - numeric(right))
  return snapshot
}

export function normalizeType(value) {
  const key = String(value ?? '').trim().toLowerCase()
  return TYPE_ALIASES[key] || key
}

function cleanString(value, max = 4096) {
  const text = String(value ?? '')
  if (text.includes('\0')) throw new Error('字段包含非法 NUL 字符')
  return text.slice(0, max)
}

function numberOr(value, fallback) {
  if (value === '' || value == null) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) throw new Error('端口必须是 0 到 65535 的整数')
  return parsed
}

function integerOr(value, fallback, min, max, label) {
  if (value === '' || value == null) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label}必须是 ${min} 到 ${max} 的整数`)
  return parsed
}

function selectedDatabase(connection, params) {
  const value = cleanString(params?.database ?? connection.database ?? '', 256).trim()
  return value || undefined
}

function sqlIdentifier(value, label, quote) {
  const raw = cleanString(value, 512).trim()
  if (!raw || /[\0\r\n;]/.test(raw) || raw.includes('--') || raw.includes('/*') || raw.includes('*/')) throw new Error(`${label}不合法`)
  const parts = raw.split('.')
  if (parts.some(part => !part || part.length > 256)) throw new Error(`${label}不合法`)
  const escaped = quote === '`' ? part => `\`${part.replaceAll('`', '``')}\`` : part => `"${part.replaceAll('"', '""')}"`
  return parts.map(escaped).join('.')
}

function validateHost(value, required) {
  const host = cleanString(value, 255).trim()
  if (required && !host) throw new Error('服务地址不能为空')
  if (/\s/.test(host)) throw new Error('服务地址不能包含空白字符')
  return host
}

function validateProxy(raw) {
  const proxy = raw && typeof raw === 'object' ? raw : { type: 'none' }
  const type = String(proxy.type || 'none').toLowerCase()
  if (!PROXY_TYPES.has(type)) throw new Error('不支持的代理模式: ' + type)
  if (type === 'none') return { type: 'none' }
  const host = validateHost(proxy.host, true)
  const port = numberOr(proxy.port, type === 'socks5' ? 1080 : type === 'ssh' ? 22 : 9000)
  const output = { type, host, port }
  if (type === 'ssh') output.username = cleanString(proxy.username || proxy.jumpUser || 'root', 128)
  else if (type === 'socks5') output.username = cleanString(proxy.username, 128)
  return output
}

export function validateConnection(input, existing = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const type = normalizeType(source.type || existing.type)
  if (!TYPES[type]) throw new Error('不支持的服务类型: ' + type)
  const defaults = TYPES[type]
  const rawOptions = source.options && typeof source.options === 'object' ? source.options : {}
  const requiresHost = !['docker', 's3'].includes(type)
  const connection = {
    id: cleanString(source.id || existing.id || '', 128),
    name: cleanString(source.name ?? existing.name ?? defaults.label, 120).trim(),
    type,
    host: validateHost(source.host ?? existing.host ?? '', requiresHost),
    port: numberOr(source.port ?? existing.port, defaults.port),
    username: cleanString(source.username ?? existing.username ?? '', 256),
    database: cleanString(source.database ?? existing.database ?? '', 256),
    authMode: type === 'ssh' && source.authMode === 'key' ? 'key' : 'password',
    options: {
      ...rawOptions,
      compatibility: COMPATIBILITY_MODES.has(rawOptions.compatibility) ? rawOptions.compatibility : 'auto',
      apiVersion: cleanString(rawOptions.apiVersion || '', 32),
      ssl: Boolean(rawOptions.ssl),
      scheme: rawOptions.scheme === 'https' || (type === 's3' && rawOptions.scheme !== 'http') ? 'https' : 'http',
      proxy: validateProxy(rawOptions.proxy),
    },
  }
  if (!connection.name) throw new Error('连接名称不能为空')
  if (type === 's3' && !connection.options.endpoint && !connection.host) connection.host = 's3.amazonaws.com'
  return connection
}

function safePath(value, fallback = '/') {
  const text = cleanString(value || fallback, 2048)
  if (!text.startsWith('/') || text.includes('..')) throw new Error('远程路径必须是绝对路径且不能包含 ..')
  return text
}

function resultText(text, extra = {}) { return { ok: true, kind: 'text', text: String(text ?? ''), ...extra } }
function resultJson(data) { return { ok: true, kind: 'json', data } }
function resultList(items) { return { ok: true, kind: 'list', items: Array.from(items || [], item => String(item)) } }

function canonicalToolValue(value) {
  const encoded = JSON.stringify(value, (_key, current) => typeof current === 'bigint' ? String(current) : current)
  if (encoded === undefined) throw new Error('服务返回结果无法转换为 JSON')
  return JSON.parse(encoded)
}

function ansiSequenceEnd(text, start, final) {
  const length = text.length
  if (start + 1 >= length) return final ? length : -1
  const second = text[start + 1]
  if (second === '[') {
    for (let index = start + 2; index < length; index++) {
      const code = text.charCodeAt(index)
      if (code >= 0x40 && code <= 0x7e) return index + 1
    }
    return final ? length : -1
  }
  if (second === ']') {
    for (let index = start + 2; index < length; index++) {
      if (text.charCodeAt(index) === 0x07) return index + 1
      if (text.charCodeAt(index) === 0x1b && text[index + 1] === '\\') return index + 2
    }
    return final ? length : -1
  }
  if (second === 'P' || second === 'X' || second === '^' || second === '_') {
    for (let index = start + 2; index < length; index++) {
      if (text.charCodeAt(index) === 0x1b && text[index + 1] === '\\') return index + 2
    }
    return final ? length : -1
  }
  if (second === '(' || second === ')' || second === '*' || second === '+' || second === '-' || second === '.' || second === '/') {
    return start + 3 <= length ? start + 3 : (final ? length : -1)
  }
  return start + 2
}

function normalizeTerminalChunk(input, final = false) {
  const text = String(input ?? '')
    .replace(/\\u001b/gi, '\x1b')
    .replace(/\\x1b/gi, '\x1b')
  let output = ''
  let index = 0
  while (index < text.length) {
    const code = text.charCodeAt(index)
    if (code === 0x1b) {
      const end = ansiSequenceEnd(text, index, final)
      if (end < 0) return { text: output, rest: text.slice(index) }
      index = end
      continue
    }
    if (code === 0x9b || code === 0x9d || code === 0x90 || code === 0x98 || code === 0x9e || code === 0x9f) {
      let end = -1
      if (code === 0x9b) {
        for (let cursor = index + 1; cursor < text.length; cursor++) {
          const finalCode = text.charCodeAt(cursor)
          if (finalCode >= 0x40 && finalCode <= 0x7e) { end = cursor + 1; break }
        }
      } else if (code === 0x9d) {
        for (let cursor = index + 1; cursor < text.length; cursor++) {
          if (text.charCodeAt(cursor) === 0x07) { end = cursor + 1; break }
          if (text.charCodeAt(cursor) === 0x1b && text[cursor + 1] === '\\') { end = cursor + 2; break }
        }
      } else {
        for (let cursor = index + 1; cursor < text.length; cursor++) {
          if (text.charCodeAt(cursor) === 0x1b && text[cursor + 1] === '\\') { end = cursor + 2; break }
        }
      }
      if (end < 0) {
        if (!final) return { text: output, rest: text.slice(index) }
        end = text.length
      }
      index = end
      continue
    }
    if (code === 0x0d) {
      output += '\n'
      index += text.charCodeAt(index + 1) === 0x0a ? 2 : 1
      continue
    }
    if (code === 0x0a || code === 0x09) {
      output += text[index]
      index++
      continue
    }
    if (code === 0x08) {
      if (output && output[output.length - 1] !== '\n') output = output.slice(0, -1)
      index++
      continue
    }
    if (code < 0x20 || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      index++
      continue
    }
    output += text[index]
    index++
  }
  return { text: output, rest: '' }
}

export function normalizeTerminalText(input) {
  return normalizeTerminalChunk(input, true).text
}

function createTerminalOutputNormalizer() {
  const decoder = new StringDecoder('utf8')
  let pending = ''
  const consume = (input, final) => {
    const result = normalizeTerminalChunk(pending + input, final)
    pending = result.rest
    return result.text
  }
  return {
    push(chunk) { return consume(decoder.write(Buffer.from(chunk)), false) },
    flush() { return consume(decoder.end(), true) },
  }
}

function resultRows(rows, fields = []) {
  const safeRows = Array.isArray(rows) ? rows : []
  const columns = fields.length ? fields.map(field => field.name) : [...new Set(safeRows.flatMap(row => row && typeof row === 'object' ? Object.keys(row) : []))]
  return { ok: true, kind: 'table', columns, rows: safeRows.map(row => columns.map(column => row?.[column])) }
}

function parseJson(value, label) {
  try { return JSON.parse(cleanString(value, 131072)) } catch { throw new Error(`${label} 必须是合法 JSON`) }
}

function decodeBase64(value, maxBytes, label) {
  const raw = String(value ?? '')
  if (raw.includes('\0') || raw.length > Math.ceil(maxBytes * 4 / 3) + 16) throw new Error(`${label} 超过大小限制`)
  const encoded = cleanString(raw, Math.ceil(maxBytes * 4 / 3) + 16)
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw new Error(`${label} 不是合法 Base64`)
  const decoded = Buffer.from(encoded, 'base64')
  if (decoded.length > maxBytes) throw new Error(`${label} 超过大小限制`)
  return decoded
}

async function streamToBuffer(stream) {
  if (stream == null) return Buffer.alloc(0)
  if (Buffer.isBuffer(stream)) return stream
  if (stream instanceof Uint8Array) return Buffer.from(stream)
  const chunks = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function tlsOptions(connection, originalHost) {
  return { rejectUnauthorized: connection.options.tlsRejectUnauthorized !== false, servername: originalHost || undefined }
}

function parseEndpoint(connection) {
  if (connection.type === 's3') {
    const raw = connection.options.endpoint || `${connection.options.scheme || 'https'}://s3.amazonaws.com`
    const url = new URL(raw)
    return { host: url.hostname, port: Number(url.port || (url.protocol === 'http:' ? 80 : 443)), url }
  }
  if (connection.type === 'docker') {
    const raw = connection.options.dockerHost || ''
    if (!raw) {
      if (!connection.host) return null
      return { host: connection.host, port: connection.port || 2375, url: undefined }
    }
    if (raw.startsWith('unix://') || raw.startsWith('npipe://')) return null
    const url = new URL(raw.includes('://') ? raw : `tcp://${raw}`)
    return { host: url.hostname, port: Number(url.port || (url.protocol === 'https:' ? 2376 : 2375)), url }
  }
  return { host: connection.host, port: connection.port || TYPES[connection.type].port }
}

function listenLocal(handler) {
  const server = createServer(handler)
  const sockets = new Set()
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)) })
  return new Promise((resolve, reject) => {
    const onError = error => { server.removeListener('listening', onListening); reject(error) }
    const onListening = () => {
      server.removeListener('error', onError)
      resolve({
        port: server.address().port,
        close: async () => {
          for (const socket of sockets) socket.destroy()
          await new Promise(done => server.close(() => done()))
        },
      })
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen({ host: '127.0.0.1', port: 0 })
  })
}

function sshConfig(connection, secrets, target, isProxy = false) {
  const proxy = connection.options.proxy
  const config = {
    host: target.host,
    port: target.port,
    username: isProxy ? (proxy.username || 'root') : connection.username,
    readyTimeout: 15_000,
    keepaliveInterval: 10_000,
  }
  const key = isProxy ? secrets.proxyKey : connection.authMode === 'key' ? secrets.privateKey : undefined
  const password = isProxy ? secrets.proxyPassword : connection.authMode === 'password' ? secrets.password : undefined
  if (key) config.privateKey = key
  else if (password) config.password = password
  if (!isProxy && connection.authMode === 'key' && !key) throw new Error('SSH 私钥认证需要填写私钥 PEM')
  if (!isProxy && connection.authMode === 'password' && !password) throw new Error('SSH 密码认证需要填写密码')
  if (connection.options.hostKeyFingerprint) {
    const fingerprint = cleanString(connection.options.hostKeyFingerprint, 256)
    config.hostVerifier = value => value === fingerprint
  }
  return config
}

function connectSsh(config) {
  const client = new SSHClient()
  client.on('error', () => {})
  return new Promise((resolve, reject) => {
    const onError = error => { client.removeListener('ready', onReady); client.end(); reject(error) }
    const onReady = () => { client.removeListener('error', onError); resolve(client) }
    client.once('error', onError)
    client.once('ready', onReady)
    client.connect(config)
  })
}

async function createTunnel(connection, secrets, endpoint) {
  const proxy = connection.options.proxy
  if (!proxy || proxy.type === 'none') return { host: endpoint.host, port: endpoint.port, endpoint, close: async () => {} }
  if (!endpoint) throw new Error(`${connection.type} 当前配置没有可代理的 TCP 端点`)
  if (proxy.type === 'ssh') {
    const jump = await connectSsh(sshConfig(connection, secrets, proxy, true))
    try {
      const local = await listenLocal(socket => {
        try {
          jump.forwardOut('127.0.0.1', socket.remotePort || 0, endpoint.host, endpoint.port, (error, upstream) => {
            if (error) return socket.destroy(error)
            socket.pipe(upstream).pipe(socket)
          })
        } catch (error) { socket.destroy(error) }
      })
      return { host: '127.0.0.1', port: local.port, endpoint, close: async () => { await local.close(); jump.end() } }
    } catch (error) {
      jump.end()
      throw error
    }
  }
  if (proxy.type === 'socks5') {
    const local = await listenLocal(socket => {
      SocksClient.createConnection({
        proxy: { host: proxy.host, port: proxy.port, type: 5, ...(proxy.username ? { userId: proxy.username } : {}), ...(secrets.proxyPassword ? { password: secrets.proxyPassword } : {}) },
        command: 'connect',
        destination: { host: endpoint.host, port: endpoint.port },
      }).then(({ socket: upstream }) => socket.pipe(upstream).pipe(socket)).catch(error => socket.destroy(error))
    })
    return { host: '127.0.0.1', port: local.port, endpoint, close: local.close }
  }
  const local = await listenLocal(socket => {
    const upstream = socket.connect(proxy.port, proxy.host)
    socket.pipe(upstream).pipe(socket)
    upstream.once('error', error => socket.destroy(error))
  })
  return { host: '127.0.0.1', port: local.port, endpoint, close: local.close }
}

function localEndpoint(network, connection) {
  if (connection.type !== 's3' || !network.endpoint) return null
  const scheme = network.endpoint.protocol
  return `${scheme}//${network.host}:${network.port}${network.endpoint.pathname === '/' ? '' : network.endpoint.pathname}`
}

async function withNetwork(connection, secrets, fn, activeTunnels) {
  const endpoint = parseEndpoint(connection)
  if (!endpoint && connection.options.proxy?.type && connection.options.proxy.type !== 'none') throw new Error(`${connection.type} 的本地套接字不能使用网络代理`)
  const network = endpoint ? await createTunnel(connection, secrets, endpoint) : { host: '', port: 0, endpoint: null, close: async () => {} }
  activeTunnels.add(network)
  try {
    network.localEndpoint = localEndpoint(network, connection)
    return await fn(network)
  } finally {
    activeTunnels.delete(network)
    await network.close()
  }
}

const SSH_SFTP_CACHE_TTL = 30_000

function sshSftpCacheKey(connection, secrets) {
  return JSON.stringify({
    id: String(connection.id),
    host: connection.host,
    port: connection.port,
    username: connection.username,
    authMode: connection.authMode,
    password: secrets.password || '',
    privateKey: secrets.privateKey || '',
  })
}

function touchSshSftpSession(entry) {
  if (!entry || entry.closed) return
  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = setTimeout(() => {
    entry.closed = true
    try { entry.client.end() } catch { /* best effort */ }
  }, SSH_SFTP_CACHE_TTL)
}

function closeSshSftpSessions(cache, connectionId) {
  for (const [key, entry] of cache) {
    if (connectionId != null && String(entry.connectionId) !== String(connectionId)) continue
    cache.delete(key)
    if (entry.timer) clearTimeout(entry.timer)
    if (entry.client) {
      entry.closed = true
      try { entry.client.end() } catch { /* best effort */ }
    }
  }
}

async function getCachedSshSftpSession(connection, secrets, network, cache) {
  if (!cache || (connection.options?.proxy?.type || 'none') !== 'none') return null
  const key = sshSftpCacheKey(connection, secrets)
  const existing = cache.get(key)
  if (existing?.pending) return existing.pending
  if (existing && !existing.closed) {
    touchSshSftpSession(existing)
    return existing
  }
  const pendingEntry = { key, connectionId: connection.id, pending: null }
  pendingEntry.pending = (async () => {
    const client = await connectSsh(sshConfig(connection, secrets, network))
    try {
      const sftp = await new Promise((resolve, reject) => client.sftp((error, value) => error ? reject(error) : resolve(value)))
      const entry = { key, connectionId: connection.id, client, sftp, closed: false, timer: null }
      client.on('close', () => {
        entry.closed = true
        if (entry.timer) clearTimeout(entry.timer)
        if (cache.get(key) === entry) cache.delete(key)
      })
      client.on('error', () => {
        entry.closed = true
        if (entry.timer) clearTimeout(entry.timer)
        if (cache.get(key) === entry) cache.delete(key)
      })
      cache.set(key, entry)
      touchSshSftpSession(entry)
      return entry
    } catch (error) {
      client.end()
      throw error
    }
  })()
  cache.set(key, pendingEntry)
  try { return await pendingEntry.pending } catch (error) {
    if (cache.get(key) === pendingEntry) cache.delete(key)
    throw error
  }
}

const SSH_SFTP_OPERATIONS = new Set(['listFiles', 'readFile', 'writeFile', 'deleteFile', 'downloadFile', 'uploadFile', 'mkdir', 'createFile', 'renameFile'])

async function execSsh(connection, secrets, network, params, sshSftpCache) {
  const cachedSession = SSH_SFTP_OPERATIONS.has(params.op) ? await getCachedSshSftpSession(connection, secrets, network, sshSftpCache) : null
  const client = cachedSession?.client || await connectSsh(sshConfig(connection, secrets, network))
  const execCommand = command => new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) return reject(error)
      const stdout = []
      const stderr = []
      stream.on('data', chunk => stdout.push(Buffer.from(chunk)))
      stream.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
      stream.once('close', code => resolve({ code: code ?? 0, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }))
      stream.on('error', reject)
      stream.stderr.on('error', reject)
    })
  })
  const sftp = () => new Promise((resolve, reject) => client.sftp((error, value) => error ? reject(error) : resolve(value)))
  try {
    if (params.op === 'inspect') {
      const result = await execCommand(SSH_INSPECT_COMMAND)
      const output = result.stdout.toString()
      if (result.code !== 0 && !output.includes('__DSH_HOST__')) throw new Error(result.stderr.toString() || `SSH 信息采集退出码 ${result.code}`)
      return resultJson(parseSshInspectOutput(output))
    }
    if (params.op === 'test' || params.op === 'query') {
      const result = await execCommand(params.op === 'test' ? 'echo ok' : cleanString(params.text, 131072))
      if (result.code !== 0) throw new Error(result.stderr.toString() || `SSH 命令退出码 ${result.code}`)
      return resultText(result.stdout.toString())
    }
    const path = safePath(params.path)
    const sftpClient = cachedSession?.sftp || await sftp()
    if (params.op === 'listFiles') return resultJson(await new Promise((resolve, reject) => sftpClient.readdir(path, (error, value) => error ? reject(error) : resolve(value))))
    if (params.op === 'readFile' || params.op === 'downloadFile') {
      const chunks = []
      await new Promise((resolve, reject) => {
        const stream = sftpClient.createReadStream(path)
        stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
        stream.on('error', reject)
        stream.once('end', resolve)
      })
      const filename = path.split('/').filter(Boolean).pop() || 'download.bin'
      return resultText(Buffer.concat(chunks).toString('base64'), { encoding: 'base64', filename })
    }
    if (params.op === 'writeFile' || params.op === 'uploadFile') {
      const content = params.op === 'uploadFile'
        ? decodeBase64(params.contentBase64, 16 * 1024 * 1024, '上传文件')
        : Buffer.from(cleanString(params.content, 4 * 1024 * 1024))
      await new Promise((resolve, reject) => {
        const stream = sftpClient.createWriteStream(path)
        stream.on('error', reject)
        stream.once('close', resolve)
        stream.end(content)
      })
      return resultText('写入成功')
    }
    if (params.op === 'mkdir') {
      await new Promise((resolve, reject) => sftpClient.mkdir(path, { mode: 0o755 }, error => error ? reject(error) : resolve()))
      return resultText('文件夹创建成功')
    }
    if (params.op === 'createFile') {
      const content = params.contentBase64
        ? decodeBase64(params.contentBase64, 4 * 1024 * 1024, '新建文件')
        : Buffer.from(cleanString(params.content, 4 * 1024 * 1024))
      await new Promise((resolve, reject) => {
        const stream = sftpClient.createWriteStream(path, { flags: 'wx' })
        stream.once('error', reject)
        stream.once('close', resolve)
        stream.end(content)
      })
      return resultText('文件创建成功')
    }
    if (params.op === 'deleteFile') {
      await new Promise((resolve, reject) => sftpClient.unlink(path, error => error ? reject(error) : resolve()))
      return resultText('文件删除成功')
    }
    if (params.op === 'renameFile') {
      const nextPath = safePath(params.newPath)
      await new Promise((resolve, reject) => sftpClient.rename(path, nextPath, error => error ? reject(error) : resolve()))
      return resultText('重命名成功')
    }
    throw new Error('不支持的 SSH 操作')
  } finally {
    if (cachedSession) touchSshSftpSession(cachedSession)
    else client.end()
  }
}

function terminalOutput(session) {
  const chunks = session.output.splice(0)
  if (session.closed && !session.flushed) {
    session.flushed = true
    const tail = session.normalizer.flush()
    if (tail) chunks.push(tail)
  }
  return { ok: true, kind: 'terminal', text: chunks.join(''), closed: Boolean(session.closed) }
}

async function createSshTerminal(connection, secrets, network) {
  const client = await connectSsh(sshConfig(connection, secrets, network))
  try {
    const stream = await new Promise((resolve, reject) => {
      client.shell({ term: 'xterm-256color', cols: 120, rows: 32 }, (error, value) => error ? reject(error) : resolve(value))
    })
    const session = { client, stream, output: [], closed: false, flushed: false, normalizer: createTerminalOutputNormalizer() }
    const appendOutput = chunk => {
      const text = session.normalizer.push(chunk)
      if (text) session.output.push(text)
    }
    stream.on('data', appendOutput)
    stream.stderr?.on('data', appendOutput)
    stream.on('error', error => { session.closed = true; session.output.push(`\n[终端错误] ${error.message || error}\n`) })
    stream.stderr?.on('error', error => { session.closed = true; session.output.push(`\n[终端错误] ${error.message || error}\n`) })
    stream.once('close', () => { session.closed = true })
    return session
  } catch (error) {
    client.end()
    throw error
  }
}

async function execFtp(connection, secrets, network, params) {
  const client = new FtpClient(30_000)
  try {
    await client.access({ host: network.host, port: network.port, user: connection.username || 'anonymous', password: secrets.password || 'guest', secure: Boolean(connection.options.ssl), secureOptions: tlsOptions(connection, connection.host) })
    const path = safePath(params.path)
    if (params.op === 'test') return resultText('连接成功')
    if (params.op === 'inspect') {
      const response = await client.send('SYST')
      return resultJson({ version: response.message || response.code || 'FTP', endpoint: `${connection.host}:${connection.port}`, config: { secure: Boolean(connection.options.ssl), mode: response.message || 'FTP' } })
    }
    if (params.op === 'listFiles') return resultJson(await client.list(path))
    if (params.op === 'readFile') {
      const output = new PassThrough()
      const chunks = []
      output.on('data', chunk => chunks.push(Buffer.from(chunk)))
      await client.downloadTo(output, path)
      const filename = path.split('/').filter(Boolean).pop() || 'download.bin'
      return resultText(Buffer.concat(chunks).toString('base64'), { encoding: 'base64', filename })
    }
    if (params.op === 'writeFile') {
      await client.uploadFrom(Readable.from([Buffer.from(cleanString(params.content, 4 * 1024 * 1024))]), path)
      return resultText('写入成功')
    }
    if (params.op === 'deleteFile') { await client.remove(path); return resultText('删除成功') }
    throw new Error('不支持的 FTP 操作')
  } finally { client.close() }
}

function redisOptions(connection, secrets, network, params) {
  const socket = { host: network.host, port: network.port }
  if (connection.options.ssl) Object.assign(socket, { tls: true, ...tlsOptions(connection, connection.host) })
  const rawDatabase = params?.database ?? connection.options.db ?? connection.database
  const database = integerOr(rawDatabase, undefined, 0, 65535, 'Redis DB 编号')
  return { socket, username: connection.username || undefined, password: secrets.password || undefined, database }
}

async function execRedis(connection, secrets, network, params) {
  const client = createRedisClient(redisOptions(connection, secrets, network, params))
  client.on('error', () => {})
  await client.connect()
  try {
    if (params.op === 'test') return resultText(await client.ping())
    if (params.op === 'info') return resultText(await client.info())
    if (params.op === 'inspect') {
      const info = Object.fromEntries((await client.info()).split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes(':')).map(line => {
        const index = line.indexOf(':')
        return [line.slice(0, index), line.slice(index + 1)]
      }))
      return resultJson({ version: info.redis_version || 'Redis', endpoint: `${connection.host}:${connection.port}`, config: { mode: info.redis_mode, os: info.os, arch: info.arch_bits ? `${info.arch_bits} bit` : '', uptime: info.uptime_in_seconds ? `${info.uptime_in_seconds}s` : '', connectedClients: info.connected_clients, usedMemory: info.used_memory_human, maxMemory: info.maxmemory_human, tcpPort: info.tcp_port } })
    }
    if (params.op === 'listKeys') {
      const items = []
      for await (const key of client.scanIterator({ MATCH: cleanString(params.pattern || '*', 1024), COUNT: 100 })) {
        items.push(key)
        if (items.length >= 5000) break
      }
      return resultList(items)
    }
    if (params.op === 'getKey') return resultJson(await client.get(cleanString(params.key, 1024)))
    if (params.op === 'setKey') return resultText(await client.set(cleanString(params.key, 1024), cleanString(params.value, 1024)))
    if (params.op === 'delKey') return resultText(await client.del(cleanString(params.key, 1024)))
    if (params.op === 'query') {
      const command = parseJson(params.text, 'Redis 命令')
      if (!Array.isArray(command) || !command.length) throw new Error('Redis 命令 JSON 必须是非空数组，例如 ["GET","key"]')
      return resultJson(await client.sendCommand(command.map(value => String(value))))
    }
    throw new Error('不支持的 Redis 操作')
  } finally { await client.quit().catch(() => client.disconnect()) }
}

function mysqlConfig(connection, secrets, network, database) {
  return { host: network.host, port: network.port, user: connection.username || undefined, password: secrets.password || undefined, database: database || undefined, multipleStatements: false, connectTimeout: 15_000, ssl: connection.options.ssl ? tlsOptions(connection, connection.host) : undefined }
}

async function execMysql(connection, secrets, network, params) {
  const database = selectedDatabase(connection, params)
  const client = await mysql.createConnection(mysqlConfig(connection, secrets, network, database))
  try {
    if (params.op === 'inspect') {
      const [rows] = await client.query('SELECT VERSION() AS version, @@version_comment AS comment, @@hostname AS hostname, @@port AS port, @@character_set_server AS charset, @@collation_server AS collation, @@sql_mode AS sql_mode')
      const row = rows?.[0] || {}
      return resultJson({ version: row.version || 'MySQL / MariaDB', endpoint: `${connection.host}:${connection.port}`, config: { comment: row.comment, hostname: row.hostname, port: row.port, charset: row.charset, collation: row.collation, sqlMode: row.sql_mode, database: database || '' } })
    }
    let sql
    if (params.op === 'test') sql = 'SELECT 1 AS ok'
    else if (params.op === 'listDatabases') sql = 'SHOW DATABASES'
    else if (params.op === 'listTables') sql = 'SHOW TABLES'
    else if (params.op === 'tableData') sql = `SELECT * FROM ${sqlIdentifier(params.table, '表名', '`')} LIMIT ${integerOr(params.limit, 100, 1, 500, '查询数量')}`
    else if (params.op === 'query') sql = cleanString(params.sql || params.text, 131072)
    else throw new Error('不支持的 MySQL/MariaDB 操作')
    const [rows, fields] = await client.query(sql)
    return resultRows(Array.isArray(rows) ? rows : [], Array.isArray(fields) ? fields : [])
  } finally { await client.end() }
}

function pgConfig(connection, secrets, network, database) {
  return { host: network.host, port: network.port, user: connection.username || undefined, password: secrets.password || undefined, database: database || 'postgres', connectionTimeoutMillis: 15_000, ssl: connection.options.ssl ? tlsOptions(connection, connection.host) : undefined }
}

async function execPostgres(connection, secrets, network, params) {
  const database = selectedDatabase(connection, params)
  const client = new PgClient(pgConfig(connection, secrets, network, database))
  await client.connect()
  try {
    if (params.op === 'inspect') {
      const result = await client.query("SELECT version() AS version, current_database() AS database, current_user AS user, current_setting('server_version') AS server_version, current_setting('server_encoding') AS encoding")
      const row = result.rows?.[0] || {}
      return resultJson({ version: row.server_version || row.version || 'PostgreSQL', endpoint: `${connection.host}:${connection.port}`, config: { database: row.database, user: row.user, encoding: row.encoding, server: row.version } })
    }
    let sql
    if (params.op === 'test') sql = 'SELECT 1 AS ok'
    else if (params.op === 'listDatabases') sql = 'SELECT datname FROM pg_database ORDER BY datname'
    else if (params.op === 'listTables') sql = "SELECT tablename FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') ORDER BY tablename"
    else if (params.op === 'tableData') sql = `SELECT * FROM ${sqlIdentifier(params.table, '表名', '"')} LIMIT ${integerOr(params.limit, 100, 1, 500, '查询数量')}`
    else if (params.op === 'query') sql = cleanString(params.sql || params.text, 131072)
    else throw new Error('不支持的 PostgreSQL 操作')
    const result = await client.query(sql)
    return resultRows(result.rows, result.fields)
  } finally { await client.end() }
}

function mssqlConfig(connection, secrets, network, database) {
  return { server: network.host, port: network.port, user: connection.username || undefined, password: secrets.password || undefined, database: database || undefined, connectionTimeout: 15_000, requestTimeout: 120_000, options: { encrypt: Boolean(connection.options.ssl), trustServerCertificate: connection.options.tlsRejectUnauthorized === false } }
}

async function execMssql(connection, secrets, network, params) {
  const database = selectedDatabase(connection, params)
  const pool = new mssql.ConnectionPool(mssqlConfig(connection, secrets, network, database))
  await pool.connect()
  try {
    if (params.op === 'inspect') {
      const result = await pool.request().query("SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) AS version, CAST(SERVERPROPERTY('ProductLevel') AS nvarchar(128)) AS level, CAST(SERVERPROPERTY('Edition') AS nvarchar(256)) AS edition, @@SERVERNAME AS server_name, DB_NAME() AS database_name")
      const row = result.recordset?.[0] || {}
      return resultJson({ version: row.version || 'SQL Server', endpoint: `${connection.host}:${connection.port}`, config: { level: row.level, edition: row.edition, server: row.server_name, database: row.database_name || database || '' } })
    }
    let sql
    if (params.op === 'test') sql = 'SELECT 1 AS ok'
    else if (params.op === 'listDatabases') sql = 'SELECT name FROM sys.databases ORDER BY name'
    else if (params.op === 'listTables') sql = "SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_SCHEMA, TABLE_NAME"
    else if (params.op === 'tableData') sql = `SELECT TOP ${integerOr(params.limit, 100, 1, 500, '查询数量')} * FROM ${sqlIdentifier(params.table, '表名', '"')}`
    else if (params.op === 'query') sql = cleanString(params.sql || params.text, 131072)
    else throw new Error('不支持的 MSSQL 操作')
    const result = await pool.request().query(sql)
    return resultRows(result.recordset || [], result.recordset?.columns ? Object.values(result.recordset.columns) : [])
  } finally { await pool.close() }
}

function elasticClient(connection, secrets, network) {
  const scheme = connection.options.scheme || (connection.options.ssl ? 'https' : 'http')
  const config = { node: `${scheme}://${network.host}:${network.port}`, requestTimeout: 120_000 }
  if (connection.username) config.auth = { username: connection.username, password: secrets.password || '' }
  if (connection.options.ssl) config.tls = tlsOptions(connection, connection.host)
  if (connection.options.compatibility === 'legacy' || connection.options.compatibility === 'modern') {
    const version = connection.options.compatibility === 'legacy' ? '7' : '8'
    config.headers = { accept: `application/vnd.elasticsearch+json; compatible-with=${version}`, 'content-type': 'application/json' }
  }
  return new ElasticsearchClient(config)
}

async function execElasticsearch(connection, secrets, network, params) {
  const client = elasticClient(connection, secrets, network)
  try {
    if (params.op === 'inspect') {
      const response = await client.info()
      const info = response.body ?? response
      return resultJson({ version: info.version?.number || 'Elasticsearch', endpoint: `${connection.host}:${connection.port}`, config: { cluster: info.cluster_name, node: info.name, build: info.version?.build_flavor, lucene: info.version?.lucene_version, tagline: info.tagline } })
    }
    let path = '/'
    let method = 'GET'
    let body
    if (params.op === 'listIndices') path = '/_cat/indices?format=json'
    else if (params.op === 'query') {
      path = cleanString(params.path || '/', 2048)
      if (!path.startsWith('/') || path.includes('://')) throw new Error('Elasticsearch API Path 必须是绝对路径')
      method = String(params.method || 'GET').toUpperCase()
      if (!SAFE_METHODS.has(method)) throw new Error('Elasticsearch method 不在允许列表中')
      body = params.body ? parseJson(params.body, 'Elasticsearch 请求体') : undefined
    } else if (params.op !== 'test') throw new Error('不支持的 Elasticsearch 操作')
    const response = await client.transport.request({ method, path, ...(body === undefined ? {} : { body }) })
    return resultJson(response.body ?? response)
  } finally { await client.close().catch(() => {}) }
}

function dockerClient(connection, network) {
  const configured = connection.options.dockerHost || ''
  if (network.host) return new Docker({ host: network.host, port: network.port, protocol: configured.startsWith('https://') ? 'https' : 'http', version: connection.options.apiVersion || undefined })
  if (configured.startsWith('unix://')) return new Docker({ socketPath: configured.slice('unix://'.length), version: connection.options.apiVersion || undefined })
  if (configured.startsWith('npipe://')) return new Docker({ socketPath: configured, version: connection.options.apiVersion || undefined })
  return new Docker({ socketPath: '/var/run/docker.sock', version: connection.options.apiVersion || undefined })
}

async function collectDockerStream(stream, docker) {
  const chunks = []
  if (docker?.modem?.demuxStream) {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    stdout.on('data', chunk => chunks.push(Buffer.from(chunk)))
    stderr.on('data', chunk => chunks.push(Buffer.from(chunk)))
    docker.modem.demuxStream(stream, stdout, stderr)
    await new Promise((resolve, reject) => { stream.once('end', resolve); stream.once('error', reject) })
  } else {
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString()
}

async function execDocker(connection, network, params) {
  const docker = dockerClient(connection, network)
  if (params.op === 'test') return resultJson(await docker.version())
  if (params.op === 'inspect') {
    const info = await docker.version()
    return resultJson({ version: info.Version || info.version || 'Docker', endpoint: connection.options.dockerHost || connection.host || '本机 Docker', config: { apiVersion: info.ApiVersion, minApiVersion: info.MinAPIVersion, os: info.Os, arch: info.Arch, kernel: info.KernelVersion, components: info.Components?.map(item => item.Name && item.Version ? `${item.Name} ${item.Version}` : item.Name).filter(Boolean).join(', ') } })
  }
  if (params.op === 'listContainers') return resultJson(await docker.listContainers({ all: true }))
  if (params.op === 'listImages') return resultJson(await docker.listImages())
  if (params.op === 'query') return resultJson(await docker.info())
  const container = docker.getContainer(cleanString(params.container, 256))
  if (params.op === 'logs') return resultText(await container.logs({ stdout: true, stderr: true, tail: integerOr(params.tail, 200, 1, 1000, '日志行数') }))
  if (params.op === 'start') { await container.start(); return resultText('启动成功') }
  if (params.op === 'stop') { await container.stop(); return resultText('停止成功') }
  if (params.op === 'exec') {
    const exec = await container.exec({ Cmd: ['sh', '-lc', cleanString(params.text, 131072)], AttachStdout: true, AttachStderr: true })
    return resultText(await collectDockerStream(await exec.start({ hijack: false, stdin: false }), docker))
  }
  throw new Error('不支持的 Docker 操作')
}

async function execMongo(connection, secrets, network, params) {
  const uri = connection.options.connectionString || `mongodb://${network.host}:${network.port}`
  const client = new MongoClient(uri, { auth: connection.username ? { username: connection.username, password: secrets.password || '' } : undefined, authSource: connection.options.authDatabase || 'admin', tls: Boolean(connection.options.ssl), tlsAllowInvalidCertificates: connection.options.tlsRejectUnauthorized === false, serverSelectionTimeoutMS: 15_000 })
  await client.connect()
  try {
    const db = client.db(selectedDatabase(connection, params) || 'test')
    if (params.op === 'test') return resultJson(await db.command({ ping: 1 }))
    if (params.op === 'inspect') {
      const info = await client.db().admin().command({ buildInfo: 1 })
      const status = await client.db().admin().command({ hello: 1 }).catch(() => ({}))
      return resultJson({ version: info.version || 'MongoDB', endpoint: `${connection.host}:${connection.port}`, config: { gitVersion: info.gitVersion, storageEngines: info.storageEngines?.join(', '), maxBsonObjectSize: info.maxBsonObjectSize, setName: status.setName, primary: status.primary, database: db.databaseName } })
    }
    if (params.op === 'listDatabases') return resultJson(await client.db().admin().listDatabases())
    if (params.op === 'listCollections') return resultJson(await db.listCollections().toArray())
    if (params.op === 'find') return resultJson(await db.collection(cleanString(params.collection, 256)).find(parseJson(params.filter || '{}', 'MongoDB Filter')).limit(integerOr(params.limit, 100, 1, 500, '返回数量')).toArray())
    if (params.op === 'query') {
      const spec = parseJson(params.text, 'MongoDB 操作')
      const collection = db.collection(cleanString(spec.collection, 256))
      if (spec.action === 'find') return resultJson(await collection.find(spec.filter || {}).limit(integerOr(spec.limit, 100, 1, 500, '返回数量')).toArray())
      if (spec.action === 'insertOne') return resultJson(await collection.insertOne(spec.document || {}))
      if (spec.action === 'updateMany') return resultJson(await collection.updateMany(spec.filter || {}, spec.update || {}))
      if (spec.action === 'deleteMany') return resultJson(await collection.deleteMany(spec.filter || {}))
      throw new Error('MongoDB 操作 action 仅支持 find、insertOne、updateMany、deleteMany')
    }
    throw new Error('不支持的 MongoDB 操作')
  } finally { await client.close() }
}

async function execCassandra(connection, secrets, network, params) {
  const authProvider = connection.username ? new cassandraAuth.PlainTextAuthProvider(connection.username, secrets.password || '') : undefined
  const client = new CassandraClient({ contactPoints: [network.host], localDataCenter: connection.options.localDataCenter || 'datacenter1', protocolOptions: { port: network.port }, sslOptions: connection.options.ssl ? tlsOptions(connection, connection.host) : undefined, authProvider })
  await client.connect()
  try {
    let cql
    if (params.op === 'test') cql = 'SELECT now() AS now FROM system.local'
    else if (params.op === 'inspect') {
      const result = await client.execute('SELECT cluster_name, release_version, cql_version, native_transport_port, data_center, rack, host_id FROM system.local')
      const row = result.rows?.[0] || {}
      return resultJson({ version: row.release_version || 'Cassandra', endpoint: `${connection.host}:${connection.port}`, config: { cluster: row.cluster_name, cqlVersion: row.cql_version, nativePort: row.native_transport_port, dataCenter: row.data_center, rack: row.rack, hostId: row.host_id } })
    }
    else if (params.op === 'listKeyspaces') cql = 'SELECT keyspace_name FROM system_schema.keyspaces'
    else if (params.op === 'listTables' || params.op === 'tableData') {
      const keyspace = cleanString(params.keyspace ?? connection.options.keyspace ?? connection.database, 256).trim()
      if (!keyspace) throw new Error('列出 Cassandra 表需要填写 Keyspace')
      if (params.op === 'listTables') cql = `SELECT table_name FROM system_schema.tables WHERE keyspace_name = '${keyspace.replaceAll("'", "''")}'`
      else cql = `SELECT * FROM ${sqlIdentifier(keyspace, 'Keyspace', '"')}.${sqlIdentifier(params.table, '表名', '"')} LIMIT ${integerOr(params.limit, 100, 1, 500, '查询数量')}`
    } else if (params.op === 'query') cql = cleanString(params.cql || params.text, 131072)
    else throw new Error('不支持的 Cassandra 操作')
    return resultRows((await client.execute(cql)).rows)
  } finally { await client.shutdown() }
}

function s3Client(connection, secrets, network) {
  const endpoint = network.localEndpoint || connection.options.endpoint || `${connection.options.scheme || 'https'}://s3.amazonaws.com`
  const parsed = new URL(endpoint)
  const config = { region: connection.options.region || 'us-east-1', endpoint, forcePathStyle: Boolean(connection.options.endpoint) || Boolean(network.localEndpoint) }
  const hasAccessKey = Boolean(secrets.accessKey)
  const hasSecretKey = Boolean(secrets.secretKey)
  if (hasAccessKey !== hasSecretKey) throw new Error('S3 Access Key 和 Secret Key 必须同时填写')
  if (hasAccessKey) config.credentials = { accessKeyId: secrets.accessKey, secretAccessKey: secrets.secretKey, ...(secrets.token ? { sessionToken: secrets.token } : {}) }
  if (network.localEndpoint && parsed.protocol === 'https:') config.requestHandler = new NodeHttpHandler({ httpsAgent: new HttpsAgent({ servername: network.endpoint.host, rejectUnauthorized: connection.options.tlsRejectUnauthorized !== false }) })
  return new S3Client(config)
}

async function execS3(connection, secrets, network, params) {
  const client = s3Client(connection, secrets, network)
  try {
    const bucket = cleanString(params.bucket || connection.options.bucket || '', 256)
    const key = cleanString(params.key || '', 2048)
    if (params.op === 'inspect') {
      const result = await client.send(new ListBucketsCommand({}))
      return resultJson({ version: 'S3 API', endpoint: network.localEndpoint || connection.options.endpoint || `${connection.options.scheme || 'https'}://${connection.host}:${connection.port}`, config: { region: connection.options.region || 'us-east-1', bucketCount: result.Buckets?.length || 0, forcePathStyle: Boolean(connection.options.endpoint) || Boolean(network.localEndpoint) } })
    }
    if (!['test', 'listBuckets'].includes(params.op) && !bucket) throw new Error('S3 操作需要 bucket')
    if (params.op === 'test' || params.op === 'listBuckets') return resultJson(await client.send(new ListBucketsCommand({})))
    if (params.op === 'listObjects') return resultJson(await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: cleanString(params.prefix || '', 2048) || undefined })))
    if (params.op === 'readObject') {
      const filename = key.split('/').filter(Boolean).pop() || 'download.bin'
      return resultText((await streamToBuffer((await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))).Body)).toString('base64'), { encoding: 'base64', filename })
    }
    if (params.op === 'writeObject') { await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(cleanString(params.content, 16 * 1024 * 1024)) })); return resultText('写入成功') }
    if (params.op === 'deleteObject') { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); return resultText('删除成功') }
    throw new Error('不支持的 S3 操作')
  } finally { client.destroy() }
}

async function executeConnection(connection, secrets, network, params, sshSftpCache) {
  switch (connection.type) {
    case 'ssh': return execSsh(connection, secrets, network, params, sshSftpCache)
    case 'ftp': return execFtp(connection, secrets, network, params)
    case 'redis': return execRedis(connection, secrets, network, params)
    case 'mysql':
    case 'mariadb': return execMysql(connection, secrets, network, params)
    case 'postgresql': return execPostgres(connection, secrets, network, params)
    case 'mssql': return execMssql(connection, secrets, network, params)
    case 'elasticsearch': return execElasticsearch(connection, secrets, network, params)
    case 'docker': return execDocker(connection, network, params)
    case 'mongodb': return execMongo(connection, secrets, network, params)
    case 'cassandra': return execCassandra(connection, secrets, network, params)
    case 's3': return execS3(connection, secrets, network, params)
    default: throw new Error('不支持的服务类型')
  }
}

function loopbackRequest(req) {
  const address = String(req.socket?.remoteAddress || '')
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

async function readJson(req, maxBytes = 256 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  if (!total) return {}
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!value || typeof value !== 'object') throw new Error('请求体必须是 JSON 对象')
  return value
}

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(body)
}

export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (!webServer) return
  const fs = ctx.get('fs')
  const credentials = ctx.get('credentials')
  const tools = ctx.get('tools')
  const sandboxPolicy = ctx.get('sandboxPolicy')
  const workspaceRoot = typeof sandboxPolicy?.workspaceRoot === 'string' ? sandboxPolicy.workspaceRoot : process.cwd()
  const activeTunnels = new Set()
  const terminalSessions = new Map()
  const sshSftpCache = new Map()
  const secretRef = (id, field) => `DSH_SERVER_${String(id).replace(/[^A-Za-z0-9_]/g, '_')}_${field.toUpperCase()}`
  const configTarget = () => fs?.resolve?.('.dsh-servers.json', { cwd: workspaceRoot })

  async function readConfig() {
    const target = await configTarget()
    if (!target || !fs) throw new Error('filesystem service unavailable')
    try {
      const stat = await fs.stat(target)
      if (!stat) return { connections: [] }
      const parsed = JSON.parse(await fs.readText(target))
      return parsed && Array.isArray(parsed.connections) ? parsed : { connections: [] }
    } catch (error) {
      if (error?.code === 'ENOENT') return { connections: [] }
      throw new Error('无法读取 .dsh-servers.json')
    }
  }

  async function writeConfig(value) {
    const target = await configTarget()
    if (!target || !fs) throw new Error('filesystem service unavailable')
    await fs.writeText(target, JSON.stringify(value, null, 2) + '\n')
  }

  async function readSecrets(id) {
    const result = {}
    if (!credentials) return result
    for (const field of SECRET_FIELDS) {
      try {
        const value = await credentials.resolve(secretRef(id, field))
        if (value?.value) result[field] = value.value
      } catch { /* optional credentials provider */ }
    }
    return result
  }

  async function setSecrets(id, values) {
    if (!values || typeof values !== 'object') return []
    if (!credentials) return Object.keys(values).length ? ['credentials service unavailable'] : []
    const warnings = []
    for (const field of SECRET_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(values, field)) continue
      try {
        if (values[field] == null || values[field] === '') await credentials.unset(secretRef(id, field))
        else await credentials.set(secretRef(id, field), String(values[field]))
      } catch (error) { warnings.push(`${field}: ${error?.message || '写入失败'}`) }
    }
    return warnings
  }

  async function publicConnection(connection) {
    const secrets = {}
    for (const field of SECRET_FIELDS) {
      try { secrets[field] = Boolean((await credentials?.resolve?.(secretRef(connection.id, field)))?.value) } catch { secrets[field] = false }
    }
    return { ...connection, secrets, options: { ...connection.options, proxy: connection.options?.proxy || { type: 'none' } } }
  }

  function referenceConnection(connection) {
    return {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      host: connection.host,
      port: connection.port,
      username: connection.username,
      database: connection.database,
      options: {
        compatibility: connection.options?.compatibility || 'auto',
        apiVersion: connection.options?.apiVersion || '',
        ssl: Boolean(connection.options?.ssl),
        scheme: connection.options?.scheme || 'http',
        proxy: { type: connection.options?.proxy?.type || 'none' },
      },
    }
  }

  async function closeTerminal(terminalId) {
    const session = terminalSessions.get(terminalId)
    if (!session) return
    terminalSessions.delete(terminalId)
    try { session.stream.end() } catch { /* best effort */ }
    try { session.client.end() } catch { /* best effort */ }
    if (session.network) {
      activeTunnels.delete(session.network)
      await session.network.close().catch(() => {})
    }
  }

  async function closeConnectionTerminals(connectionId) {
    await Promise.all([...terminalSessions].filter(([, session]) => session.connectionId === connectionId).map(([terminalId]) => closeTerminal(terminalId)))
  }

  async function terminalAction(connection, secrets, params) {
    if (params.op === 'terminalOpen') {
      await closeConnectionTerminals(connection.id)
      const endpoint = parseEndpoint(connection)
      const network = await createTunnel(connection, secrets, endpoint)
      activeTunnels.add(network)
      try {
        const session = await createSshTerminal(connection, secrets, network)
        const terminalId = `term_${Date.now().toString(36)}_${randomInt(1000, 9999)}`
        session.terminalId = terminalId
        session.connectionId = connection.id
        session.network = network
        terminalSessions.set(terminalId, session)
        return { ...terminalOutput(session), terminalId }
      } catch (error) {
        activeTunnels.delete(network)
        await network.close().catch(() => {})
        throw error
      }
    }
    const terminalId = cleanString(params.terminalId, 128)
    const session = terminalSessions.get(terminalId)
    if (!session || session.connectionId !== connection.id) throw new Error('SSH 终端会话不存在或已关闭')
    if (params.op === 'terminalWrite') {
      const data = cleanString(params.data, 65536)
      if (data) session.stream.write(data)
      return terminalOutput(session)
    }
    if (params.op === 'terminalRead') return terminalOutput(session)
    if (params.op === 'terminalResize') {
      const cols = Math.max(20, Math.min(400, Number(params.cols || 120)))
      const rows = Math.max(5, Math.min(200, Number(params.rows || 32)))
      session.stream.setWindow?.(rows, cols, 0, 0)
      return terminalOutput(session)
    }
    if (params.op === 'terminalClose') {
      await closeTerminal(terminalId)
      return { ok: true, kind: 'terminal', closed: true, text: '' }
    }
    throw new Error('不支持的 SSH 终端操作')
  }

  async function execConnection(args) {
    const cfg = await readConfig()
    const connection = cfg.connections.find(item => item.id === args.id)
    if (!connection) throw new Error('连接不存在')
    const secrets = await readSecrets(connection.id)
    if (connection.type === 'ssh' && String(args.params?.op || '').startsWith('terminal')) return terminalAction(connection, secrets, args.params || {})
    return withNetwork(connection, secrets, network => executeConnection(connection, secrets, network, args.params || {}, sshSftpCache), activeTunnels)
  }

  function connectionAlias(connection, connections) {
    const name = String(connection.name || '').trim()
    const base = /^[A-Za-z0-9_-]+$/.test(name) ? name : String(connection.id)
    const duplicate = connections.some(item => {
      if (String(item.id) === String(connection.id)) return false
      const itemName = String(item.name || '').trim()
      return (/^[A-Za-z0-9_-]+$/.test(itemName) ? itemName : String(item.id)) === base
    })
    return duplicate ? `${base}_${connection.id}` : base
  }

  function resolveConnectionReference(config, value) {
    const raw = cleanString(value, 256).trim()
    const token = raw.replace(/^@/, '')
    if (!token) throw new Error('服务器引用不能为空')
    const connection = config.connections.find(item => item.id === token || item.name === token || connectionAlias(item, config.connections) === token)
    if (!connection) throw new Error(`服务器引用不存在: ${token}`)
    return connection
  }

  if (tools) {
    ctx.tools.register(defineTool({
      name: 'dsh_server_manage',
      description: [
        'Operate a configured server through the dsh-service-manage Node.js SDK channel.',
        'Use this tool whenever the user provides a <dsh-server-ref> or @server reference.',
        'The plugin resolves credentials through the DSH credentials service and opens the configured SSH/TCP/proxy channel internally.',
        'Never use bash, shell, ssh, sshpass, paramiko, local ~/.ssh files, ~/.dsh/.credentials.yaml, or environment variables to access a referenced server.',
        'For SSH terminals call terminalOpen, then terminalRead/terminalWrite, and terminalClose when finished.',
        'Credentials and proxy secrets are never returned by this tool.',
      ].join(' '),
      parameters: {
        server: { type: 'string', required: true, description: 'Configured server id, name, alias, or @alias from dsh-server-ref.' },
        operation: { type: 'string', required: true, enum: SERVICE_TOOL_OPERATIONS, description: 'Service operation to execute.' },
        params: { type: 'object', additionalProperties: true, description: 'Operation parameters, such as path, text, database, table, bucket, or terminalId.' },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(args, exec) {
        if (exec.signal.aborted) throw new Error('服务操作已取消')
        const config = await readConfig()
        const connection = resolveConnectionReference(config, args.server)
        if (!SERVICE_TOOL_OPERATION_SET.has(args.operation)) throw new Error(`不支持的服务操作: ${args.operation}`)
        const params = args.params && typeof args.params === 'object' ? args.params : {}
        const result = canonicalToolValue(await execConnection({ id: connection.id, params: { ...params, op: args.operation } }))
        if (exec.signal.aborted) throw new Error('服务操作已取消')
        return result
      },
    }))
    tools.guard(execution => {
      if (!['bash', 'pwsh'].includes(execution.name)) return undefined
      const command = String(execution.arguments?.command || '')
      if (!REMOTE_SHELL_FALLBACK_PATTERN.test(command)) return undefined
      return '访问已配置服务器必须使用 dsh_server_manage；请勿通过本地 shell、SSH/数据库/服务 CLI、sshpass、paramiko 或本机凭据文件建立远程连接。'
    })
  }

  async function handler(req, res) {
    if (!loopbackRequest(req)) return json(res, 403, { ok: false, error: '服务管理接口只接受本机请求' })
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
    try {
      const args = await readJson(req)
      const op = String(args.op || '')
      if (op === 'list') {
        const cfg = await readConfig()
        return json(res, 200, { ok: true, connections: await Promise.all(cfg.connections.map(publicConnection)) })
      }
      if (op === 'reference') {
        const id = cleanString(args.id, 128)
        const cfg = await readConfig()
        const connection = cfg.connections.find(item => item.id === id)
        if (!connection) throw new Error('连接不存在')
        return json(res, 200, { ok: true, connection: referenceConnection(connection) })
      }
      if (op === 'types') return json(res, 200, { ok: true, types: Object.entries(TYPES).map(([key, value]) => ({ key, ...value, implementation: 'node-sdk' })) })
      if (op === 'capabilities') return json(res, 200, { ok: true, implementation: 'node-sdk', available: Object.fromEntries(Object.keys(TYPES).map(type => [type, true])) })
      if (op === 'save') {
        const cfg = await readConfig()
        const old = cfg.connections.find(item => item.id === args.connection?.id)
        const connection = validateConnection(args.connection || {}, old || {})
        if (!connection.id) connection.id = `srv_${Date.now().toString(36)}_${randomInt(1000, 9999)}`
        const index = cfg.connections.findIndex(item => item.id === connection.id)
        if (index >= 0) cfg.connections[index] = connection
        else cfg.connections.push(connection)
        closeSshSftpSessions(sshSftpCache, connection.id)
        await writeConfig(cfg)
        const warnings = await setSecrets(connection.id, args.secrets)
        return json(res, 200, { ok: true, connection: await publicConnection(connection), warnings })
      }
      if (op === 'delete') {
        const id = cleanString(args.id, 128)
        const cfg = await readConfig()
        cfg.connections = cfg.connections.filter(item => item.id !== id)
        await writeConfig(cfg)
        await setSecrets(id, Object.fromEntries(SECRET_FIELDS.map(field => [field, ''])))
        await closeConnectionTerminals(id)
        closeSshSftpSessions(sshSftpCache, id)
        return json(res, 200, { ok: true })
      }
      if (op === 'disconnect') return json(res, 200, { ok: true })
      if (op === 'exec') return json(res, 200, await execConnection(args))
      return json(res, 400, { ok: false, error: '未知操作' })
    } catch (error) { return json(res, 400, { ok: false, error: error?.message || String(error) }) }
  }

  ctx.effect(() => webServer.register({ kind: 'exact', path: '/api/dsh-service-manage', handler }), 'dsh-service-manage: api route')
  ctx.effect(() => async () => {
    await Promise.all([...terminalSessions.keys()].map(terminalId => closeTerminal(terminalId)))
    closeSshSftpSessions(sshSftpCache)
    await Promise.all([...activeTunnels].map(tunnel => tunnel.close().catch(() => {})))
    activeTunnels.clear()
  }, 'dsh-service-manage: sdk tunnel cleanup')
}
