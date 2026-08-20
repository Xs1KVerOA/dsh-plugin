// Adapted from dsh-web-testing: host-side MITM and Web Fuzzer runtime.
import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { connect as netConnect, isIP } from 'node:net'
import { lookup } from 'node:dns/promises'
import { connect as tlsConnect } from 'node:tls'
import { URL } from 'node:url'

import Schema from 'schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { SocksClient } from 'socks'

export const TestConfig = Schema.object({
  listenHost: Schema.string().default('127.0.0.1'),
  listenPort: Schema.number().default(0),
  maxFlows: Schema.number().default(1000),
  maxBodyBytes: Schema.number().default(1024 * 1024),
  dnsLookupTimeoutMs: Schema.number().default(2000),
  autoStart: Schema.boolean().default(false),
})

const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade',
])
const SECRET_HEADERS = new Set([
  'authorization', 'cookie', 'proxy-authorization', 'set-cookie', 'x-api-key',
])
const MAX_JSON_BODY = 4 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_DNS_LOOKUP_TIMEOUT_MS = 2_000
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const DEFAULT_HAE_RULES = [
  { id: 'jwt', name: 'JWT', regex: '\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b', flags: 'g', scope: 'any', format: '{0}', sensitive: true, color: '#ffe08a' },
  { id: 'email', name: 'Email', regex: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b', flags: 'gi', scope: 'any', format: '{0}', sensitive: false, color: '#bde7ff' },
  { id: 'aws-access-key', name: 'AWS Access Key', regex: '\\bAKIA[0-9A-Z]{16}\\b', flags: 'g', scope: 'any', format: '{0}', sensitive: true, color: '#ffc9c9' },
  { id: 'bearer-token', name: 'Bearer Token', regex: '\\bBearer\\s+[A-Za-z0-9._~+/=-]+', flags: 'gi', scope: 'any', format: '{0}', sensitive: true, color: '#d8c8ff' },
  { id: 'github-token', name: 'GitHub Token', regex: '\\b(?:ghp|gho|ghs|ghr)_[A-Za-z0-9]{20,255}\\b', flags: 'g', scope: 'any', format: '{0}', sensitive: true, color: '#ffd1a8' },
  { id: 'private-key', name: 'Private Key', regex: '-----BEGIN [A-Z0-9 ]+PRIVATE KEY-----[\\s\\S]+?-----END [A-Z0-9 ]+PRIVATE KEY-----', flags: 'g', scope: 'any', format: '{0}', sensitive: true, color: '#f7b7d2' },
  { id: 'generic-secret', name: 'Secret Assignment', regex: '\\b(?:api[_-]?key|secret|password|token)\\s*[:=]\\s*["\\\']?[A-Za-z0-9._~+/=-]{12,}', flags: 'gi', scope: 'any', format: '{0}', sensitive: false, color: '#d8c8ff' },
]

function clampInt(value, fallback, min, max) {
  const n = Number(value)
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}

function normalizeLoopbackHost(value) {
  const host = String(value || '127.0.0.1').trim().toLowerCase()
  if (!LOOPBACK_HOSTS.has(host)) throw new Error('MITM 监听地址只允许 loopback（127.0.0.1、localhost 或 ::1）')
  return host
}

function normalizeConfig(config = {}) {
  return {
    listenHost: normalizeLoopbackHost(config.listenHost),
    listenPort: clampInt(config.listenPort, 0, 0, 65535),
    maxFlows: clampInt(config.maxFlows, 1000, 1, 10_000),
    maxBodyBytes: clampInt(config.maxBodyBytes, 1024 * 1024, 1024, 16 * 1024 * 1024),
    dnsLookupTimeoutMs: clampInt(config.dnsLookupTimeoutMs, DEFAULT_DNS_LOOKUP_TIMEOUT_MS, 100, 10_000),
    autoStart: config.autoStart === true,
  }
}

function stringList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  return String(value || '').split(/[\n,]/).map(item => item.trim()).filter(Boolean)
}

function normalizeHaeScope(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || 'any')
  const scope = raw.trim().toLowerCase().replace(/[ _]/g, '-')
  if (!scope || ['any', 'all', 'full', 'both', 'request-response', 'request/response'].includes(scope)) return 'any'
  if (scope.includes('request') && scope.includes('body')) return 'request-body'
  if (scope.includes('request') && scope.includes('header')) return 'request-headers'
  if (scope.includes('response') && scope.includes('body')) return 'response-body'
  if (scope.includes('response') && scope.includes('header')) return 'response-headers'
  if (scope === 'request' || scope === 'response') return scope
  if (scope === 'headers' || scope === 'bodies') return scope
  return 'any'
}

function normalizeHaeRules(value) {
  const rules = value == null ? DEFAULT_HAE_RULES : (Array.isArray(value) ? value : DEFAULT_HAE_RULES)
  return rules.map((rule, index) => {
    const item = rule && typeof rule === 'object' ? rule : {}
    const regex = String(item.regex || item.fRegex || item['F-Regex'] || '')
    if (!regex) throw new Error(`HaE 规则 ${index + 1} 缺少 regex / F-Regex`)
    const secondaryRegex = String(item.secondaryRegex || item.sRegex || item['S-Regex'] || '')
    const sensitive = item.sensitive ?? item.Sensitive
    let flags = [...new Set(String(item.flags || 'g').replace(/[^dgimsuvy]/g, '').split(''))].join('')
    if (sensitive === false && !flags.includes('i')) flags += 'i'
    if (sensitive === true) flags = flags.replace(/i/g, '')
    const executableFlags = flags.includes('g') ? flags : flags + 'g'
    try { new RegExp(regex, executableFlags) } catch { throw new Error(`HaE 规则 ${index + 1} 的正则无效`) }
    if (secondaryRegex) {
      try { new RegExp(secondaryRegex, executableFlags.replace(/g|y/g, '')) } catch { throw new Error(`HaE 规则 ${index + 1} 的 S-Regex 无效`) }
    }
    const colorValue = item.color || item.Color || ''
    const color = /^#[0-9a-f]{6}$/i.test(String(colorValue)) ? String(colorValue) : '#ffe08a'
    return {
      id: String(item.id || `hae_${index + 1}`),
      name: String(item.name || item.id || `规则 ${index + 1}`),
      regex,
      secondaryRegex,
      format: String(item.format || item.Format || '{0}'),
      scope: normalizeHaeScope(item.scope || item.Scope),
      engine: String(item.engine || item.Engine || 'nfa').toLowerCase() === 'dfa' ? 'dfa' : 'nfa',
      sensitive: sensitive !== false,
      flags: executableFlags,
      color,
      enabled: item.enabled !== false && item.Loaded !== false,
    }
  })
}

export function normalizeMitmConfig(config = {}) {
  const mode = config.mode == null ? 'observe' : (config.mode === 'manual' ? 'manual' : 'observe')
  const autoReleaseRules = Array.isArray(config.autoReleaseRules) ? config.autoReleaseRules.filter(item => item && typeof item === 'object') : []
  const holdResponse = config.holdResponse == null ? mode === 'manual' : config.holdResponse === true
  return {
    listenHost: normalizeLoopbackHost(config.listenHost),
    listenPort: clampInt(config.listenPort, 0, 0, 65535),
    enabled: config.enabled !== false,
    mode,
    interceptRoutes: stringList(config.interceptRoutes),
    interceptSuffixes: stringList(config.interceptSuffixes),
    autoReleaseRules,
    holdResponse,
    haeEnabled: config.haeEnabled !== false,
    haeRules: normalizeHaeRules(config.haeRules),
  }
}

export function mergeMitmConfig(current = {}, patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('MITM 配置必须是 JSON 对象')
  }
  return normalizeMitmConfig({ ...(current || {}), ...patch })
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

async function readBody(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const value = Buffer.from(chunk)
    size += value.length
    if (size > limit) throw new Error(`请求体超过 ${limit} 字节限制`)
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

function stringHeaders(headers) {
  const result = {}
  for (const [key, value] of Object.entries(headers || {})) {
    if (value == null) continue
    result[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return result
}

function upstreamHeaders(headers) {
  const result = {}
  for (const [key, value] of Object.entries(headers || {})) {
    const normalized = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(normalized) || normalized === 'host' || normalized === 'content-length') continue
    result[key] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  result['accept-encoding'] = 'identity'
  return result
}

function responseHeaders(headers, browser = false) {
  const result = {}
  for (const [key, value] of Object.entries(headers || {})) {
    const normalized = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(normalized)) continue
    if (browser && ['content-security-policy', 'content-security-policy-report-only', 'x-frame-options', 'content-encoding', 'content-length'].includes(normalized)) continue
    result[key] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return result
}

function maskedHeaders(headers) {
  const result = {}
  for (const [key, value] of Object.entries(headers || {})) {
    result[key] = SECRET_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value
  }
  return result
}

function bodyPreview(body, limit = 16 * 1024) {
  if (body == null || body.length === 0) return { text: '', truncated: false, binary: false }
  const source = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : body instanceof Uint8Array ? body : String(body))
  const slice = source.subarray(0, limit)
  const text = slice.toString('utf8')
  const binary = text.includes('\u0000')
  return {
    text: binary ? slice.toString('base64') : text,
    encoding: binary ? 'base64' : 'utf8',
    truncated: source.length > slice.length,
    binary,
  }
}

function ipv4Parts(host) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return undefined
  const parts = host.split('.').map(Number)
  return parts.every(value => value >= 0 && value <= 255) ? parts : undefined
}

function ipv6Groups(host) {
  let value = String(host || '').toLowerCase()
  const zone = value.indexOf('%')
  if (zone >= 0) value = value.slice(0, zone)
  if (value.includes('.')) {
    const separator = value.lastIndexOf(':')
    const parts = ipv4Parts(value.slice(separator + 1))
    if (!parts || separator < 0) return undefined
    const high = ((parts[0] << 8) | parts[1]).toString(16)
    const low = ((parts[2] << 8) | parts[3]).toString(16)
    value = `${value.slice(0, separator + 1)}${high}:${low}`
  }
  const halves = value.split('::')
  if (halves.length > 2) return undefined
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : []
  const right = halves.length === 2 && halves[1] ? halves[1].split(':').filter(Boolean) : []
  if ([...left, ...right].some(item => !/^[0-9a-f]{1,4}$/.test(item))) return undefined
  const missing = halves.length === 2 ? 8 - left.length - right.length : 0
  if (missing < 0 || (halves.length === 1 && left.length !== 8)) return undefined
  return [...left, ...Array.from({ length: missing }, () => '0'), ...right].map(item => item.padStart(4, '0'))
}

export function isPrivateAddress(address) {
  const host = String(address || '').replace(/^\[|\]$/g, '').toLowerCase()
  const parts = ipv4Parts(host)
  if (parts) {
    const [a, b] = parts
    return a === 0 || a === 10 || (a === 100 && b >= 64 && b <= 127) || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) || (a === 198 && b >= 18 && b <= 19) || a >= 224
  }
  const groups = ipv6Groups(host)
  if (!groups) return false
  if (groups.slice(0, 5).every(item => item === '0000') && groups[5] === 'ffff') {
    const mapped = [parseInt(groups[6].slice(0, 2), 16), parseInt(groups[6].slice(2), 16), parseInt(groups[7].slice(0, 2), 16), parseInt(groups[7].slice(2), 16)]
    return isPrivateAddress(mapped.join('.'))
  }
  const first = parseInt(groups[0], 16)
  const allZero = groups.every(item => item === '0000')
  const loopback = groups.slice(0, 7).every(item => item === '0000') && groups[7] === '0001'
  return allZero || loopback || (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00
}

export function isPrivateTarget(target) {
  const url = target instanceof URL ? target : new URL(String(target))
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0' || host.endsWith('.local') || host.endsWith('.internal')) return true
  return isPrivateAddress(host)
}

export async function resolveTargetAddresses(target, timeoutMs = DEFAULT_DNS_LOOKUP_TIMEOUT_MS) {
  const host = target instanceof URL ? target.hostname.replace(/^\[|\]$/g, '') : new URL(String(target)).hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) return [host]
  let timer
  try {
    const result = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS lookup timeout')), timeoutMs) }),
    ])
    const addresses = [...new Set(result.map(item => item.address).filter(Boolean))]
    if (!addresses.length) throw new Error('DNS lookup returned no address')
    return addresses
  } finally {
    clearTimeout(timer)
  }
}

function formatAuthorityHost(host) {
  const value = String(host || '')
  return value.includes(':') && !value.startsWith('[') ? `[${value}]` : value
}

function proxyTargetUrl(target, address) {
  return `${target.protocol}//${formatAuthorityHost(address)}${target.port ? `:${target.port}` : ''}${requestPath(target)}`
}

function pinnedLookup(address) {
  const family = isIP(address)
  return (_hostname, _options, callback) => {
    if (typeof _options === 'function') callback = _options
    callback(null, address, family)
  }
}

export function normalizeTarget(raw, hostHeader) {
  const input = String(raw || '').trim()
  if (!input) throw new Error('目标 URL 不能为空')
  let target
  try {
    const candidate = /^https?:\/\//i.test(input)
      ? input
      : input.startsWith('/') && hostHeader
        ? `http://${hostHeader}${input}`
        : `http://${hostHeader || input}`
    target = new URL(candidate)
  } catch {
    throw new Error('目标 URL 无效')
  }
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('仅支持 HTTP/HTTPS 目标')
  return target
}

export function replacePayloadTokens(value, payloads) {
  return String(value == null ? '' : value).replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, name) => {
    const valueForName = payloads && Object.prototype.hasOwnProperty.call(payloads, name) ? payloads[name] : ''
    return String(valueForName == null ? '' : valueForName)
  })
}

export function parseRawHttp(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const separator = text.indexOf('\n\n')
  const head = separator >= 0 ? text.slice(0, separator) : text
  const body = separator >= 0 ? text.slice(separator + 2) : ''
  const lines = head.split('\n')
  const first = lines.shift() || ''
  const match = /^([A-Z][A-Z0-9-]{0,15})\s+(\S+)\s+HTTP\/1\.[01]$/i.exec(first.trim())
  if (!match) throw new Error('raw HTTP 首行必须是 METHOD /path HTTP/1.1')
  const headers = {}
  for (const line of lines) {
    const split = line.indexOf(':')
    if (split <= 0) throw new Error('raw HTTP header 无效: ' + line)
    headers[line.slice(0, split).trim()] = line.slice(split + 1).trim()
  }
  const host = headers.host || headers.Host
  if (!host && !/^https?:\/\//i.test(match[2])) throw new Error('raw HTTP 缺少 Host header')
  const url = /^https?:\/\//i.test(match[2]) ? match[2] : `http://${host}${match[2].startsWith('/') ? match[2] : '/' + match[2]}`
  return { method: safeMethod(match[1]), url, headers, body: body || undefined }
}

export function expandPayloads(payloads, maxCases = 500) {
  const entries = Object.entries(payloads && typeof payloads === 'object' ? payloads : {})
    .map(([name, values]) => [name, Array.isArray(values) ? values : [values]])
    .map(([name, values]) => [name, values.length ? values : ['']])
  let cases = [{}]
  for (const [name, values] of entries) {
    const next = []
    for (const current of cases) {
      for (const value of values) {
        next.push({ ...current, [name]: value })
        if (next.length >= maxCases) break
      }
      if (next.length >= maxCases) break
    }
    cases = next
    if (cases.length >= maxCases) break
  }
  return cases
}

function countPayloadCases(payloads, limit = 500) {
  const entries = Object.values(payloads && typeof payloads === 'object' ? payloads : {})
    .map(values => Array.isArray(values) ? values : [values])
    .map(values => values.length ? values.length : 1)
  let total = 1
  for (const size of entries) {
    total *= size
    if (total > limit) return limit + 1
  }
  return total
}

export function evaluateAssertions(assertions, response) {
  const list = assertions && typeof assertions === 'object' ? assertions : {}
  const reasons = []
  if (Array.isArray(list.status) && list.status.length && !list.status.map(Number).includes(response.status)) reasons.push(`status=${response.status}`)
  if (list.contains && !response.text.includes(String(list.contains))) reasons.push(`body missing ${JSON.stringify(String(list.contains))}`)
  if (list.notContains && response.text.includes(String(list.notContains))) reasons.push(`body contains forbidden ${JSON.stringify(String(list.notContains))}`)
  if (list.regex) {
    let matched = false
    try { matched = new RegExp(String(list.regex)).test(response.text) } catch { reasons.push('regex invalid') }
    if (!matched && !reasons.includes('regex invalid')) reasons.push('body regex mismatch')
  }
  if (list.maxDurationMs != null && response.durationMs > Number(list.maxDurationMs)) reasons.push(`duration=${response.durationMs}ms`)
  return { matched: reasons.length === 0, reasons }
}

function safeMethod(value) {
  const method = String(value || 'GET').toUpperCase()
  if (!/^[A-Z][A-Z0-9-]{0,15}$/.test(method)) throw new Error('HTTP method 无效')
  return method
}

function parseHeaders(value) {
  if (value == null || value === '') return {}
  if (typeof value === 'object' && !Array.isArray(value)) return stringHeaders(value)
  try {
    const parsed = JSON.parse(String(value))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
    return stringHeaders(parsed)
  } catch {
    throw new Error('headers 必须是 JSON 对象')
  }
}

function requestSpec(spec, payloads) {
  const template = spec && typeof spec === 'object' ? spec : {}
  if (template.raw != null) return parseRawHttp(replacePayloadTokens(template.raw, payloads))
  const headers = parseHeaders(template.headers)
  return {
    method: replacePayloadTokens(safeMethod(template.method), payloads),
    url: replacePayloadTokens(template.url, payloads),
    headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [replacePayloadTokens(key, payloads), replacePayloadTokens(value, payloads)])),
    body: template.body == null ? undefined : replacePayloadTokens(template.body, payloads),
  }
}

function timeoutSignal(parentSignal, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const abort = () => controller.abort()
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort()
    else parentSignal.addEventListener('abort', abort, { once: true })
  }
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      parentSignal?.removeEventListener('abort', abort)
    },
  }
}

export function normalizeNetwork(network = {}) {
  const proxyUrl = String(network.proxyUrl || '').trim()
  let proxy
  if (proxyUrl) {
    try { proxy = new URL(proxyUrl) } catch { throw new Error('代理地址无效') }
    if (!['http:', 'https:', 'socks5:', 'socks5h:'].includes(proxy.protocol)) throw new Error('代理仅支持 HTTP、HTTPS、SOCKS5')
    if (!proxy.hostname || !proxy.port) throw new Error('代理地址必须包含主机和端口')
  }
  const ca = String(network.ca || '').trim()
  const cert = String(network.cert || '').trim()
  const key = String(network.key || '').trim()
  if ((cert && !key) || (!cert && key)) throw new Error('客户端证书和客户端私钥必须同时配置')
  return {
    proxyUrl,
    proxy,
    ca: ca || undefined,
    cert: cert || undefined,
    key: key || undefined,
    rejectUnauthorized: network.rejectUnauthorized !== false,
    forceHttps: network.forceHttps === true,
  }
}

function proxyAuthHeader(proxy) {
  if (!proxy?.username && !proxy?.password) return undefined
  const username = decodeURIComponent(proxy.username || '')
  const password = decodeURIComponent(proxy.password || '')
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

function requestPath(target) {
  return `${target.pathname || '/'}${target.search || ''}`
}

function transportHeaders(input, target, extra = {}) {
  const headers = upstreamHeaders(input.headers)
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'host') delete headers[key]
  }
  headers.host = target.host
  headers.connection = 'close'
  return { ...headers, ...extra }
}

function collectNodeResponse(request, timerSignal) {
  return new Promise((resolve, reject) => {
    let settled = false
    const fail = error => {
      if (settled) return
      settled = true
      reject(error)
    }
    request.once('error', fail)
    request.once('timeout', () => fail(new Error('请求超时')))
    request.once('response', response => {
      const chunks = []
      let size = 0
      response.on('data', chunk => {
        const value = Buffer.from(chunk)
        size += value.length
        chunks.push(value)
      })
      response.on('end', () => {
        if (settled) return
        settled = true
        const body = Buffer.concat(chunks, size)
        resolve({
          status: response.statusCode || 0,
          headers: stringHeaders(response.headers),
          body,
          text: body.toString('utf8'),
        })
      })
      response.once('error', fail)
    })
    if (timerSignal) timerSignal.addEventListener('abort', () => request.destroy(new Error('请求超时或已取消')), { once: true })
  })
}

function writeNodeBody(request, input) {
  if (input.body && !['GET', 'HEAD'].includes(input.method)) request.write(input.body)
  request.end()
}

async function requestOverSocket(target, input, network, socket, timerSignal) {
  const request = httpRequest({
    hostname: target.hostname,
    port: Number(target.port || (target.protocol === 'https:' ? 443 : 80)),
    method: input.method,
    path: requestPath(target),
    headers: transportHeaders(input, target),
    agent: false,
    createConnection: () => socket,
    signal: timerSignal,
  })
  const responsePromise = collectNodeResponse(request, timerSignal)
  writeNodeBody(request, input)
  return responsePromise
}

function tlsOptions(target, network) {
  return {
    ca: network.ca,
    cert: network.cert,
    key: network.key,
    rejectUnauthorized: network.rejectUnauthorized,
    servername: target.hostname,
  }
}

function secureSocket(socket, target, network, timerSignal) {
  return new Promise((resolve, reject) => {
    const tlsSocket = tlsConnect({ socket, ...tlsOptions(target, network) })
    const fail = error => { tlsSocket.destroy(); reject(error) }
    tlsSocket.once('secureConnect', () => resolve(tlsSocket))
    tlsSocket.once('error', fail)
    timerSignal?.addEventListener('abort', () => tlsSocket.destroy(new Error('请求超时或已取消')), { once: true })
  })
}

async function connectThroughHttpProxy(target, input, network, timerSignal, connectHostname) {
  const proxy = network.proxy
  const proxyRequestFn = proxy.protocol === 'https:' ? httpsRequest : httpRequest
  const destination = `${formatAuthorityHost(connectHostname)}:${Number(target.port || 443)}`
  const proxySocket = await new Promise((resolve, reject) => {
    const request = proxyRequestFn({
      hostname: proxy.hostname,
      port: Number(proxy.port),
      method: 'CONNECT',
      path: destination,
      headers: {
        host: destination,
        ...(proxyAuthHeader(proxy) ? { 'proxy-authorization': proxyAuthHeader(proxy) } : {}),
      },
      agent: false,
      rejectUnauthorized: network.rejectUnauthorized,
      ca: network.ca,
      signal: timerSignal,
    })
    request.once('connect', (response, socket, head) => {
      if (response.statusCode !== 200) {
        socket.destroy()
        reject(new Error(`代理 CONNECT 失败: ${response.statusCode || 'unknown'}`))
        return
      }
      if (head?.length) socket.unshift(head)
      resolve(socket)
    })
    request.once('error', reject)
    request.end()
  })
  const tlsSocket = await secureSocket(proxySocket, target, network, timerSignal)
  return requestOverSocket(target, input, network, tlsSocket, timerSignal)
}

async function requestThroughSocks(target, input, network, timerSignal, connectHostname) {
  const proxy = network.proxy
  const destinationPort = Number(target.port || (target.protocol === 'https:' ? 443 : 80))
  const { socket } = await SocksClient.createConnection({
    proxy: {
      host: proxy.hostname,
      port: Number(proxy.port),
      type: 5,
      ...(proxy.username || proxy.password ? { userId: decodeURIComponent(proxy.username || ''), password: decodeURIComponent(proxy.password || '') } : {}),
    },
    destination: { host: connectHostname, port: destinationPort },
  })
  timerSignal?.addEventListener('abort', () => socket.destroy(), { once: true })
  if (target.protocol === 'https:') {
    const tlsSocket = await secureSocket(socket, target, network, timerSignal)
    return requestOverSocket(target, input, network, tlsSocket, timerSignal)
  }
  return requestOverSocket(target, input, network, socket, timerSignal)
}

async function requestWithNodeTransport(target, input, network, timerSignal, resolvedAddresses = []) {
  const connectHostname = resolvedAddresses[0] || target.hostname
  if (network.proxy?.protocol === 'socks5:' || network.proxy?.protocol === 'socks5h:') {
    return requestThroughSocks(target, input, network, timerSignal, connectHostname)
  }
  if (target.protocol === 'https:' && network.proxy) {
    return connectThroughHttpProxy(target, input, network, timerSignal, connectHostname)
  }
  if (network.proxy) {
    const proxy = network.proxy
    const requestFn = proxy.protocol === 'https:' ? httpsRequest : httpRequest
    const proxyRequest = requestFn({
      hostname: proxy.hostname,
      port: Number(proxy.port),
      method: input.method,
      path: proxyTargetUrl(target, connectHostname),
      headers: transportHeaders(input, target, proxyAuthHeader(proxy) ? { 'proxy-authorization': proxyAuthHeader(proxy) } : {}),
      agent: false,
      rejectUnauthorized: network.rejectUnauthorized,
      ca: network.ca,
      signal: timerSignal,
    })
    const responsePromise = collectNodeResponse(proxyRequest, timerSignal)
    writeNodeBody(proxyRequest, input)
    return responsePromise
  }
  const requestFn = target.protocol === 'https:' ? httpsRequest : httpRequest
  const request = requestFn({
    protocol: target.protocol,
    hostname: connectHostname,
    port: Number(target.port || (target.protocol === 'https:' ? 443 : 80)),
    method: input.method,
    path: requestPath(target),
    headers: transportHeaders(input, target),
    agent: false,
    lookup: pinnedLookup(connectHostname),
    ...(target.protocol === 'https:' ? tlsOptions(target, network) : {}),
    signal: timerSignal,
  })
  const responsePromise = collectNodeResponse(request, timerSignal)
  writeNodeBody(request, input)
  return responsePromise
}

function makeFlow(state, input) {
  const flow = {
    id: `flow_${Date.now().toString(36)}_${state.nextFlow++}`,
    source: input.source || 'proxy',
    method: input.method,
    url: input.url,
    requestHeaders: input.requestHeaders || {},
    requestBody: input.requestBody || Buffer.alloc(0),
    startedAt: Date.now(),
    durationMs: undefined,
    status: undefined,
    responseHeaders: {},
    responseBody: Buffer.alloc(0),
    error: undefined,
    metadata: input.metadata || {},
  }
  state.flows.unshift(flow)
  while (state.flows.length > state.config.maxFlows) state.flows.pop()
  return flow
}

function matchesFlowRule(input, match = {}) {
  const method = String(input.method || '').toUpperCase()
  if (match.method && String(match.method).toUpperCase() !== method) return false
  const url = String(input.url || '')
  if (match.urlContains && !url.includes(String(match.urlContains))) return false
  let pathname = ''
  try { pathname = new URL(url).pathname } catch {}
  if (match.pathContains && !pathname.includes(String(match.pathContains))) return false
  if (match.suffix && !pathname.endsWith(String(match.suffix))) return false
  if (match.header && typeof match.header === 'object') {
    const key = String(match.header.name || '').toLowerCase()
    const actual = Object.entries(input.headers || {}).find(([name]) => name.toLowerCase() === key)?.[1]
    if (actual == null || (match.header.value != null && String(actual) !== String(match.header.value))) return false
  }
  return true
}

function shouldIntercept(state, input) {
  const config = state.mitm
  if (!config?.enabled || config.mode !== 'manual') return false
  let target
  try { target = new URL(String(input.url)) } catch { return false }
  if (config.interceptRoutes.length && !config.interceptRoutes.some(route => String(input.url).includes(route) || target.pathname.includes(route))) return false
  if (config.interceptSuffixes.length && !config.interceptSuffixes.some(suffix => target.pathname.endsWith(suffix))) return false
  if (config.autoReleaseRules.some(rule => matchesFlowRule(input, rule.match || rule))) return false
  return true
}

function resolvePendingStage(state, flow, stage, result) {
  const key = `${flow.id}:${stage}`
  const pending = state.pending.get(key)
  if (!pending) return false
  clearPendingStage(state, flow, stage)
  pending.resolve(result)
  return true
}

/**
 * Re-evaluate requests that were already held when the MITM configuration
 * changed. Configuration updates must affect the live queue as well as new
 * traffic; otherwise switching to observe/auto-release leaves old requests
 * blocked until the user manually opens each one.
 */
function reconcilePendingInterceptions(state) {
  let releasedRequests = 0
  let releasedResponses = 0
  for (const flow of state.flows) {
    const stage = flow.metadata?.pendingStage
    if (stage === 'request') {
      const stillIntercepted = shouldIntercept(state, {
        method: flow.method,
        url: flow.url,
        headers: flow.requestHeaders,
      })
      if (!stillIntercepted && resolvePendingStage(state, flow, 'request', { action: 'release', reason: 'MITM 配置已更新，当前请求自动放行' })) {
        flow.metadata.configAutoReleased = true
        releasedRequests += 1
      }
    } else if (stage === 'response' && state.mitm?.holdResponse === false) {
      if (resolvePendingStage(state, flow, 'response', { action: 'release', reason: 'MITM 配置已更新，当前响应自动放行' })) {
        flow.metadata.configAutoReleased = true
        releasedResponses += 1
      }
    }
  }
  return { releasedRequests, releasedResponses }
}

function packetText(headers, body) {
  const head = Object.entries(headers || {}).map(([key, value]) => `${key}: ${value}`).join('\n')
  const bodyText = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '')
  return `${head}${head && bodyText ? '\n\n' : ''}${bodyText}`
}

function haeScopeMatches(scope, context) {
  const value = normalizeHaeScope(scope)
  if (value === 'any' || value === 'headers' || value === 'bodies') return true
  return value === context || value.startsWith(`${context}-`)
}

function formatHaeValue(match, format) {
  const template = String(format || '{0}')
  return template.replace(/\{(\d+)\}/g, (_, index) => String(match?.[Number(index)] ?? ''))
}

function extractHaeHighlights(text, rules, context = 'any') {
  const source = String(text || '')
  const matches = []
  for (const rule of rules || []) {
    if (rule.enabled === false) continue
    if (!haeScopeMatches(rule.scope, context)) continue
    let regex
    const flags = String(rule.flags || 'g')
    const executableFlags = flags.includes('g') ? flags : flags + 'g'
    try { regex = new RegExp(rule.regex, executableFlags) } catch { continue }
    for (const item of source.matchAll(regex)) {
      const primaryValue = String(item[0] || '')
      if (!primaryValue) continue
      let highlightedValue = primaryValue
      let extractedValue = formatHaeValue(item, rule.format)
      if (rule.secondaryRegex) {
        try {
          const secondary = new RegExp(rule.secondaryRegex, executableFlags.replace(/g|y/g, ''))
          const secondaryMatch = secondary.exec(primaryValue)
          if (!secondaryMatch) continue
          highlightedValue = String(secondaryMatch[0] || '')
          extractedValue = formatHaeValue(secondaryMatch, rule.format)
        } catch { continue }
      }
      if (!highlightedValue) continue
      const primaryStart = item.index ?? 0
      const relativeStart = Math.max(0, primaryValue.indexOf(highlightedValue))
      const start = primaryStart + relativeStart
      matches.push({ ruleId: rule.id, name: rule.name, color: rule.color, start, end: start + highlightedValue.length, value: extractedValue || highlightedValue, scope: rule.scope || 'any' })
      if (matches.length >= 500) break
    }
    if (matches.length >= 500) break
  }
  return matches.sort((left, right) => left.start - right.start || right.end - left.end)
}

function updateFlowHighlights(state, flow) {
  flow.metadata ||= {}
  if (!state.mitm?.haeEnabled) {
    flow.highlights = { request: [], response: [] }
    flow.metadata.haeCount = 0
    flow.metadata.haeByRule = {}
    return
  }
  flow.highlights = {
    request: extractHaeHighlights(packetText(maskedHeaders(flow.requestHeaders), flow.requestBody), state.mitm.haeRules, 'request'),
    response: extractHaeHighlights(packetText(maskedHeaders(flow.responseHeaders), flow.responseBody), state.mitm.haeRules, 'response'),
  }
  const allMatches = [...flow.highlights.request, ...flow.highlights.response]
  flow.metadata.haeCount = allMatches.length
  flow.metadata.haeByRule = allMatches.reduce((summary, item) => {
    summary[item.ruleId] = (summary[item.ruleId] || 0) + 1
    return summary
  }, {})
}

function refreshHaeHighlights(state) {
  for (const flow of state.flows) updateFlowHighlights(state, flow)
}

function clearPendingStage(state, flow, stage) {
  const key = `${flow.id}:${stage}`
  const pending = state.pending.get(key)
  if (pending) {
    clearTimeout(pending.timer)
    state.pending.delete(key)
  }
  if (flow.metadata.pendingStage === stage) delete flow.metadata.pendingStage
}

function dropAllPending(state, reason) {
  for (const [key, pending] of state.pending.entries()) {
    clearTimeout(pending.timer)
    state.pending.delete(key)
    const separator = key.lastIndexOf(':')
    const flowId = separator >= 0 ? key.slice(0, separator) : ''
    const stage = pending.stage || (separator >= 0 ? key.slice(separator + 1) : '')
    const flow = state.flows.find(item => item.id === flowId)
    if (flow?.metadata?.pendingStage === stage) delete flow.metadata.pendingStage
    pending.resolve({ action: 'drop', reason })
  }
  state.pending.clear()
}

function waitForFlowAction(state, flow, stage) {
  return new Promise(resolve => {
    const key = `${flow.id}:${stage}`
    const timer = setTimeout(() => {
      state.pending.delete(key)
      if (flow.metadata.pendingStage === stage) delete flow.metadata.pendingStage
      resolve({ action: 'drop', reason: `${stage === 'request' ? '请求' : '响应'}等待操作超时` })
    }, 15 * 60 * 1000)
    state.pending.set(key, { resolve, timer, stage })
    flow.metadata.pendingStage = stage
  })
}

function droppedFlowResponse(state, flow, stage, reason) {
  const body = Buffer.from(reason || `${stage} dropped`, 'utf8')
  flow.status = 499
  flow.error = reason || `${stage} dropped`
  flow.responseHeaders = { 'content-type': 'text/plain; charset=utf-8' }
  flow.responseBody = body
  flow.durationMs = Date.now() - flow.startedAt
  updateFlowHighlights(state, flow)
  return { status: 499, headers: flow.responseHeaders, body, text: body.toString('utf8'), durationMs: flow.durationMs, flow }
}

function applyRules(state, input) {
  if (input.source === 'fuzzer') return { kind: 'pass', input }
  for (const rule of state.rules) {
    if (rule.enabled === false) continue
    const match = rule.match && typeof rule.match === 'object' ? rule.match : {}
    if (!matchesFlowRule(input, match)) continue
    const action = rule.action && typeof rule.action === 'object' ? rule.action : {}
    if (action.type === 'block') return { kind: 'block', status: Number(action.status) || 403, body: String(action.body || 'blocked by dsh-web-testing'), ruleId: rule.id }
    if (action.type === 'replace') {
      const next = { ...input, headers: { ...input.headers }, metadata: { ...(input.metadata || {}), ruleId: rule.id } }
      if (action.url) next.url = String(action.url)
      if (action.method) next.method = safeMethod(action.method)
      if (action.body != null) next.body = Buffer.from(String(action.body))
      if (action.headers && typeof action.headers === 'object') next.headers = stringHeaders(action.headers)
      return { kind: 'pass', input: next, ruleId: rule.id }
    }
  }
  return { kind: 'pass', input }
}

function publicFlow(flow, detail = false) {
  const request = bodyPreview(flow.requestBody)
  const response = bodyPreview(flow.responseBody)
  request.packet = packetText(maskedHeaders(flow.requestHeaders), flow.requestBody)
  response.packet = packetText(maskedHeaders(flow.responseHeaders), flow.responseBody)
  const result = {
    id: flow.id,
    requestId: flow.id,
    source: flow.source,
    method: flow.method,
    requestMethod: String(flow.method || '').toUpperCase(),
    url: flow.url,
    requestHeaders: maskedHeaders(flow.requestHeaders),
    responseHeaders: maskedHeaders(flow.responseHeaders),
    request,
    response,
    startedAt: flow.startedAt,
    requestTime: flow.startedAt,
    // Pending interceptions do not have a duration/status/error yet. Use
    // explicit nulls: Cordis tool output is lossless JSON and rejects object
    // properties whose value is undefined.
    durationMs: Number.isFinite(flow.durationMs) ? flow.durationMs : null,
    status: Number.isFinite(flow.status) ? flow.status : null,
    responseSizeBytes: Buffer.isBuffer(flow.responseBody) ? flow.responseBody.length : Buffer.byteLength(String(flow.responseBody || '')),
    error: flow.error == null ? null : String(flow.error),
    metadata: flow.metadata || {},
    highlights: flow.highlights || { request: [], response: [] },
  }
  if (detail) {
    result.request.full = bodyPreview(flow.requestBody, flow.requestBody.length || 1)
    result.response.full = bodyPreview(flow.responseBody, flow.responseBody.length || 1)
  }
  return result
}

function sendRawResponse(res, status, headers, body) {
  const clean = responseHeaders(headers)
  clean['content-length'] = String(body.length)
  res.writeHead(status, clean)
  res.end(body)
}

function browserProxyPath(target) {
  return `/api/dsh-web-testing/browser?url=${encodeURIComponent(target)}`
}

export function rewriteHtmlForProxy(html, baseUrl, route = browserProxyPath) {
  const rewrite = value => {
    const raw = String(value || '').trim()
    if (!raw || raw.startsWith('#') || /^(?:data|javascript|mailto|tel|blob):/i.test(raw)) return value
    let resolved
    try { resolved = new URL(raw, baseUrl) } catch { return value }
    if (!['http:', 'https:'].includes(resolved.protocol)) return value
    return route(resolved.href)
  }
  let output = String(html || '')
  output = output.replace(/(\s(?:src|href|action|poster)\s*=\s*["'])([^"']+)(["'])/gi, (_match, prefix, value, suffix) => prefix + rewrite(value) + suffix)
  output = output.replace(/(\s(?:srcset)\s*=\s*["'])([^"']+)(["'])/gi, (_match, prefix, value, suffix) => {
    const next = value.split(',').map(item => {
      const parts = item.trim().split(/\s+/)
      if (parts[0]) parts[0] = rewrite(parts[0])
      return parts.join(' ')
    }).join(', ')
    return prefix + next + suffix
  })
  const bootstrap = `<script>(function(){const base=${JSON.stringify(String(baseUrl))},route=${JSON.stringify(route(''))};const p=function(v){try{const u=new URL(String(v),base);return /^https?:$/.test(u.protocol)?route+encodeURIComponent(u.href):v}catch(e){return v}};const f=window.fetch;if(f)window.fetch=function(i,o){if(typeof i==='string')i=p(i);else if(i&&i.url){try{i=new Request(p(i.url),i)}catch(e){}}return f.call(this,i,o)};const X=window.XMLHttpRequest;if(X){const open=X.prototype.open;X.prototype.open=function(m,u){arguments[1]=p(u);return open.apply(this,arguments)}}const w=window.open;if(w)window.open=function(u){return w.call(this,p(u))}})();</script>`
  return /<head\b[^>]*>/i.test(output) ? output.replace(/<head\b[^>]*>/i, match => match + bootstrap) : bootstrap + output
}

async function requestWithFetch(state, input) {
  const network = normalizeNetwork(input.network)
  let target = normalizeTarget(input.url, input.hostHeader)
  if (network.forceHttps && target.protocol === 'http:') {
    target = new URL(target.href)
    target.protocol = 'https:'
    if (target.port === '80') target.port = ''
  }
  const resolvedAddresses = await resolveTargetAddresses(target, state.config.dnsLookupTimeoutMs)
  const ruled = applyRules(state, { ...input, url: target.href })
  if (ruled.kind === 'block') {
    const flow = makeFlow(state, {
      source: input.source, method: input.method, url: target.href,
      requestHeaders: stringHeaders(input.headers), requestBody: input.body,
      metadata: { ...(input.metadata || {}), ruleId: ruled.ruleId, blocked: true },
    })
    flow.status = ruled.status
    flow.responseBody = Buffer.from(ruled.body)
    flow.durationMs = Date.now() - flow.startedAt
    return { status: ruled.status, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: flow.responseBody, text: ruled.body, durationMs: flow.durationMs, flow }
  }
  let ruledTarget = normalizeTarget(ruled.input.url, ruled.input.hostHeader)
  if (network.forceHttps && ruledTarget.protocol === 'http:') {
    ruledTarget = new URL(ruledTarget.href)
    ruledTarget.protocol = 'https:'
    if (ruledTarget.port === '80') ruledTarget.port = ''
  }
  const ruledAddresses = await resolveTargetAddresses(ruledTarget, state.config.dnsLookupTimeoutMs)
  input = { ...ruled.input, url: ruledTarget.href, network }
  const timer = timeoutSignal(input.signal, input.timeoutMs || DEFAULT_TIMEOUT_MS)
  const flow = makeFlow(state, {
    source: input.source,
    method: input.method,
    url: ruledTarget.href,
    requestHeaders: stringHeaders(input.headers),
    requestBody: input.body,
    metadata: { ...(input.metadata || {}), ...(input.interception ? { intercepted: true } : {}) },
  })
  updateFlowHighlights(state, flow)
  try {
    if (input.interception?.requestHold) {
      const requestAction = await waitForFlowAction(state, flow, 'request')
      if (requestAction.action === 'drop') return droppedFlowResponse(state, flow, 'request', requestAction.reason || '请求已手动丢弃')
    }
    let response = await requestWithNodeTransport(ruledTarget, input, network, timer.signal, ruledAddresses)
    let redirectTarget = ruledTarget
    let redirectInput = input
    for (let redirectCount = 0; input.redirect === 'follow' && redirectCount < 5 && response.status >= 300 && response.status < 400 && response.headers.location; redirectCount += 1) {
      const nextTarget = new URL(response.headers.location, redirectTarget)
      if (!['http:', 'https:'].includes(nextTarget.protocol)) throw new Error('重定向目标协议不受支持')
      const nextAddresses = await resolveTargetAddresses(nextTarget, state.config.dnsLookupTimeoutMs)
      const nextMethod = response.status === 303 || ((response.status === 301 || response.status === 302) && input.method === 'POST') ? 'GET' : input.method
      redirectInput = { ...redirectInput, url: nextTarget.href, method: nextMethod, body: nextMethod === 'GET' ? undefined : redirectInput.body }
      response = await requestWithNodeTransport(nextTarget, redirectInput, network, timer.signal, nextAddresses)
      redirectTarget = nextTarget
    }
    const bytes = response.body
    const stored = bytes.subarray(0, state.config.maxBodyBytes)
    flow.status = response.status
    flow.responseHeaders = response.headers
    flow.responseBody = stored
    flow.durationMs = Date.now() - flow.startedAt
    flow.metadata.responseTruncated = bytes.length > stored.length
    updateFlowHighlights(state, flow)
    if (input.interception?.responseHold) {
      const responseAction = await waitForFlowAction(state, flow, 'response')
      if (responseAction.action === 'drop') {
        const body = Buffer.from(responseAction.reason || '响应已手动丢弃')
        response = { status: 499, headers: { 'content-type': 'text/plain; charset=utf-8' }, body, text: body.toString('utf8') }
        flow.status = response.status
        flow.error = response.text
        flow.responseHeaders = response.headers
        flow.responseBody = body
        updateFlowHighlights(state, flow)
      } else if (responseAction.action === 'replaceResponse') {
        const body = Buffer.from(String(responseAction.body ?? ''), 'utf8')
        response = { status: Number(responseAction.status) || response.status, headers: stringHeaders(responseAction.headers || response.headers), body, text: body.toString('utf8') }
        flow.status = response.status
        flow.responseHeaders = response.headers
        flow.responseBody = body.subarray(0, state.config.maxBodyBytes)
        flow.metadata.responseOverridden = true
        updateFlowHighlights(state, flow)
      }
    }
    return {
      status: response.status,
      headers: response.headers,
      body: response.body,
      text: response.text,
      durationMs: flow.durationMs,
      flow,
    }
  } catch (error) {
    flow.error = error?.name === 'AbortError' ? '请求超时或已取消' : (error?.message || String(error))
    flow.durationMs = Date.now() - flow.startedAt
    throw error
  } finally {
    timer.dispose()
  }
}

async function connectTunnel(state, req, clientSocket, head) {
  let target
  try { target = normalizeTarget(`http://${req.url}`) } catch (error) {
    clientSocket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    clientSocket.destroy()
    return
  }
  let addresses
  try { addresses = await resolveTargetAddresses(target, state.config.dnsLookupTimeoutMs) } catch {
    clientSocket.write('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n')
    clientSocket.destroy()
    return
  }
  const flow = makeFlow(state, {
    source: 'proxy-connect', method: 'CONNECT', url: target.href,
    requestHeaders: {}, metadata: { httpsPassthrough: true },
  })
  const upstream = netConnect(Number(target.port || 443), addresses[0])
  const close = () => {
    flow.durationMs = Date.now() - flow.startedAt
    flow.metadata.closed = true
  }
  upstream.once('connect', () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head && head.length) upstream.write(head)
    clientSocket.pipe(upstream)
    upstream.pipe(clientSocket)
  })
  upstream.once('error', error => {
    flow.error = error?.message || String(error)
    clientSocket.destroy()
  })
  clientSocket.once('error', () => upstream.destroy())
  clientSocket.once('close', close)
  upstream.once('close', close)
}

function proxyRequest(state, req, res) {
  void (async () => {
    const target = normalizeTarget(req.url, req.headers.host)
    const body = await readBody(req, state.config.maxBodyBytes)
    const interception = shouldIntercept(state, { method: safeMethod(req.method), url: target.href, headers: req.headers })
      ? { requestHold: true, responseHold: state.mitm.holdResponse }
      : undefined
    const result = await requestWithFetch(state, {
      source: 'proxy', method: safeMethod(req.method), url: target.href,
      headers: req.headers, body, redirect: 'manual', interception,
    })
    sendRawResponse(res, result.status, result.headers, result.body)
  })().catch(error => {
    if (!res.headersSent) json(res, error.message?.startsWith('已阻止') ? 403 : 502, { ok: false, error: error.message || String(error) })
    else res.destroy()
  })
}

function resolveFlowAction(state, id, payload = {}) {
  const flow = state.flows.find(item => item.id === String(id || ''))
  if (!flow) throw new Error('flow 不存在')
  const stage = flow.metadata.pendingStage
  if (!stage) throw new Error('流量当前没有等待中的操作')
  const pending = state.pending.get(`${flow.id}:${stage}`)
  if (!pending) throw new Error('流量等待操作已失效')
  const action = String(payload.action || '')
  let result
  if (stage === 'request' && action === 'release-request') {
    flow.metadata.requestReleased = true
    result = { action: 'release' }
  } else if (stage === 'request' && action === 'drop-request') {
    result = { action: 'drop', reason: '请求已手动丢弃' }
  } else if (stage === 'response' && action === 'release-response') {
    flow.metadata.responseReleased = true
    result = { action: 'release' }
  } else if (stage === 'response' && action === 'replace-response') {
    flow.metadata.responseReleased = true
    result = { action: 'replaceResponse', status: payload.status, headers: payload.headers, body: payload.body }
  } else if (stage === 'response' && action === 'drop-response') {
    result = { action: 'drop', reason: '响应已手动丢弃' }
  } else {
    throw new Error(`不支持的 ${stage} 阶段操作: ${action}`)
  }
  clearPendingStage(state, flow, stage)
  pending.resolve(result)
  return flow
}

function matchPath(pathname, suffix) {
  return pathname === `/api/dsh-web-testing/${suffix}` || pathname === `/api/dsh-web-testing/${suffix}/`
}

export function makeRuntime(config) {
  const state = { config, mitm: normalizeMitmConfig(), flows: [], rules: [], pending: new Map(), sockets: new Set(), nextFlow: 1, server: undefined, endpoint: undefined, proxyError: '' }
  let startPromise
  let stopPromise

  async function startProxy(options = {}) {
    if (state.server) return state.endpoint
    if (stopPromise) await stopPromise
    if (state.server) return state.endpoint
    if (startPromise) return startPromise
    const operation = (async () => {
      const host = normalizeLoopbackHost(options.host || state.mitm.listenHost || config.listenHost)
      const port = clampInt(options.port, state.mitm.listenPort ?? config.listenPort, 0, 65535)
      const server = createHttpServer((req, res) => proxyRequest(state, req, res))
      server.on('connection', socket => {
        state.sockets.add(socket)
        socket.once('close', () => state.sockets.delete(socket))
      })
      server.on('connect', (req, socket, head) => connectTunnel(state, req, socket, head))
      try {
        await new Promise((resolve, reject) => {
          const onError = error => { server.removeListener('listening', onListening); reject(error) }
          const onListening = () => { server.removeListener('error', onError); resolve() }
          server.once('error', onError)
          server.once('listening', onListening)
          server.listen({ host, port })
        })
        const address = server.address()
        state.server = server
        state.endpoint = { host, port: typeof address === 'object' && address ? address.port : port, protocol: 'http' }
        state.proxyError = ''
        return state.endpoint
      } catch (error) {
        state.proxyError = String(error?.message || error)
        for (const socket of state.sockets) socket.destroy()
        try { server.close() } catch {}
        throw error
      }
    })()
    startPromise = operation
    try { return await operation } finally { if (startPromise === operation) startPromise = undefined }
  }

  async function stopProxy() {
    if (stopPromise) return stopPromise
    const operation = (async () => {
      const pendingStart = startPromise
      if (pendingStart) await pendingStart.catch(() => {})
      const server = state.server
      state.server = undefined
      state.endpoint = undefined
      dropAllPending(state, '代理已停止')
      for (const socket of state.sockets) socket.destroy()
      if (!server) return
      await new Promise(resolve => {
        try { server.close(() => resolve()) } catch { resolve() }
      })
    })()
    stopPromise = operation
    try { return await operation } finally { if (stopPromise === operation) stopPromise = undefined }
  }

  async function browserRoute(req, res, url) {
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(String(req.method || 'GET').toUpperCase())) return json(res, 405, { ok: false, error: '不支持的浏览器方法' })
    const body = await readBody(req, state.config.maxBodyBytes)
    const interception = shouldIntercept(state, { method: safeMethod(req.method), url, headers: req.headers })
      ? { requestHold: true, responseHold: state.mitm.holdResponse }
      : undefined
    const result = await requestWithFetch(state, {
      source: 'browser', method: safeMethod(req.method), url,
      headers: req.headers, body, redirect: 'follow', interception,
    })
    const contentType = String(result.headers['content-type'] || '').toLowerCase()
    let output = result.body
    const headers = responseHeaders(result.headers, true)
    if (contentType.includes('text/html')) {
      output = Buffer.from(rewriteHtmlForProxy(result.text, result.flow.url), 'utf8')
      headers['content-type'] = result.headers['content-type'] || 'text/html; charset=utf-8'
    }
    headers['content-length'] = String(output.length)
    res.writeHead(result.status, headers)
    if (req.method !== 'HEAD') res.end(output)
    else res.end()
  }

  async function runFuzzer(spec, signal) {
    if (spec?.enabled === false) throw new Error('Web Fuzzer 当前已停用，请先在左侧配置中开启。')
    const maxCases = clampInt(spec?.maxCases, 500, 1, 500)
    const cases = expandPayloads(spec?.payloads, maxCases)
    const totalCaseCount = countPayloadCases(spec?.payloads, maxCases)
    const concurrency = clampInt(spec?.concurrency, 4, 1, 16)
    const timeoutMs = clampInt(spec?.timeoutMs, DEFAULT_TIMEOUT_MS, 100, 120_000)
    const results = new Array(cases.length)
    let cursor = 0
    const worker = async () => {
      while (true) {
        if (signal?.aborted) throw new Error('Fuzzer 已取消')
        const index = cursor++
        if (index >= cases.length) return
        const payloads = cases[index]
        let request = { method: '-', url: '-' }
        const started = Date.now()
        try {
          request = requestSpec(spec?.request, payloads)
          const response = await requestWithFetch(state, {
            source: 'fuzzer', ...request, timeoutMs, signal,
            network: spec?.network,
            metadata: { caseIndex: index, payloads },
          })
          const assertion = evaluateAssertions(spec?.assertions, response)
          results[index] = {
            index, payloads, method: request.method, url: request.url,
            status: response.status, durationMs: Date.now() - started,
            size: response.body.length, matched: assertion.matched,
            reasons: assertion.reasons, flowId: response.flow.id,
          }
        } catch (error) {
          results[index] = {
            index, payloads, method: request.method, url: request.url,
            durationMs: Date.now() - started, matched: false,
            reasons: [error?.message || String(error)],
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, worker))
    return {
      total: results.length,
      matched: results.filter(item => item?.matched).length,
      failed: results.filter(item => item && !item.matched).length,
      truncated: totalCaseCount > cases.length,
      results,
    }
  }

  async function browserApi(req, res, parsed) {
    const url = parsed.searchParams.get('url')
    if (!url) return json(res, 400, { ok: false, error: '缺少 url' })
    await browserRoute(req, res, url)
  }

  async function apiHandler(req, res) {
    const parsed = new URL(req.url || '/', 'http://dsh-web-testing.local')
    try {
      if (parsed.pathname === '/api/dsh-web-testing/status') return json(res, 200, { ok: true, proxy: state.endpoint || null, proxyError: state.proxyError || null, flowCount: state.flows.length, pendingCount: state.pending.size, config: state.config, mitm: state.mitm })
      if (matchPath(parsed.pathname, 'config')) {
        if (req.method === 'GET') return json(res, 200, { ok: true, mitm: state.mitm })
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 GET/POST' })
        const body = await readBody(req, MAX_JSON_BODY)
        const patch = body.length ? JSON.parse(body.toString('utf8')) : {}
        state.mitm = mergeMitmConfig(state.mitm, patch)
        const released = reconcilePendingInterceptions(state)
        refreshHaeHighlights(state)
        return json(res, 200, { ok: true, mitm: state.mitm, released })
      }
      if (matchPath(parsed.pathname, 'flows')) return json(res, 200, { ok: true, flows: state.flows.slice(0, clampInt(parsed.searchParams.get('limit'), 100, 1, 500)).map(flow => publicFlow(flow)) })
      if (matchPath(parsed.pathname, 'rules')) {
        if (req.method === 'GET') return json(res, 200, { ok: true, rules: state.rules })
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 GET/POST' })
        const body = await readBody(req, MAX_JSON_BODY)
        const rule = body.length ? JSON.parse(body.toString('utf8')) : {}
        const normalized = { ...rule, id: String(rule.id || `rule_${Date.now().toString(36)}`) }
        const index = state.rules.findIndex(item => item.id === normalized.id)
        if (index >= 0) state.rules[index] = normalized
        else state.rules.push(normalized)
        return json(res, 200, { ok: true, rule: normalized })
      }
      if (parsed.pathname.startsWith('/api/dsh-web-testing/rules/')) {
        if (req.method !== 'DELETE') return json(res, 405, { ok: false, error: '仅支持 DELETE' })
        const id = decodeURIComponent(parsed.pathname.slice('/api/dsh-web-testing/rules/'.length))
        state.rules = state.rules.filter(item => item.id !== id)
        return json(res, 200, { ok: true })
      }
      if (parsed.pathname.startsWith('/api/dsh-web-testing/flow/')) {
        const id = decodeURIComponent(parsed.pathname.slice('/api/dsh-web-testing/flow/'.length))
        if (id.endsWith('/action')) {
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
          const flowId = id.slice(0, -'/action'.length).replace(/\/$/, '')
          const body = await readBody(req, MAX_JSON_BODY)
          const payload = body.length ? JSON.parse(body.toString('utf8')) : {}
          return json(res, 200, { ok: true, flow: publicFlow(resolveFlowAction(state, flowId, payload), true) })
        }
        const flow = state.flows.find(item => item.id === id)
        return flow ? json(res, 200, { ok: true, flow: publicFlow(flow, true) }) : json(res, 404, { ok: false, error: 'flow 不存在' })
      }
      if (matchPath(parsed.pathname, 'clear')) {
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
        dropAllPending(state, '流量已清空')
        state.flows.length = 0
        return json(res, 200, { ok: true })
      }
      if (matchPath(parsed.pathname, 'proxy/start')) {
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
        const body = await readBody(req, MAX_JSON_BODY)
        const options = body.length ? JSON.parse(body.toString('utf8')) : {}
        return json(res, 200, { ok: true, proxy: await startProxy(options) })
      }
      if (matchPath(parsed.pathname, 'proxy/stop')) {
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
        await stopProxy()
        return json(res, 200, { ok: true })
      }
      if (matchPath(parsed.pathname, 'fuzz')) {
        if (req.method !== 'POST') return json(res, 405, { ok: false, error: '仅支持 POST' })
        const body = await readBody(req, MAX_JSON_BODY)
        const spec = body.length ? JSON.parse(body.toString('utf8')) : {}
        return json(res, 200, { ok: true, result: await runFuzzer(spec) })
      }
      if (parsed.pathname === '/api/dsh-web-testing/browser') {
        if (req.method === 'OPTIONS') return json(res, 204, {})
        return await browserApi(req, res, parsed)
      }
      return json(res, 404, { ok: false, error: '未知接口' })
    } catch (error) {
      return json(res, error?.message?.startsWith('已阻止') ? 403 : 400, { ok: false, error: error?.message || String(error) })
    }
  }

  return { state, startProxy, stopProxy, runFuzzer, apiHandler }
}

export function applyWebTesting(ctx, rawConfig = {}) {
  const config = normalizeConfig(rawConfig)
  const runtime = makeRuntime(config)
  const webServer = ctx.get('webServer')
  const tools = ctx.get('tools')
  const sessions = ctx.get('sessions')

  ctx.effect(() => webServer.register({ kind: 'prefix', path: '/api/dsh-web-testing', handler: runtime.apiHandler }), 'dsh-web-testing: api')
  if (tools) {
    // Web Fuzzer and MITM are penetration-testing capabilities. Keep a
    // defense-in-depth execution guard because a stale client/tool catalog or
    // a direct tool call must not bypass the code-audit preset restriction.
    if (typeof tools.guard === 'function') {
      tools.guard(execution => {
        if (!['dsh_web_fuzzer', 'dsh_mitm_capture'].includes(String(execution?.name || ''))) return undefined
        let session = execution?.agent?.session
        const visited = new Set()
        for (let depth = 0; session && depth < 32; depth += 1) {
          const id = String(session.id || '')
          if (id && visited.has(id)) break
          if (id) visited.add(id)
          const header = session.header || {}
          const events = Array.isArray(session.events) ? session.events : []
          const selected = [...events].reverse().find(event => event?.type === 'agent-preset/selected')?.data?.agentPreset
          const preset = header.agentPreset || session.agentPreset || selected
          if (preset === 'code-audit') return '代码审计模式不提供 Web Fuzzer/MITM；请直接使用 dsh_code_audit_start 拉取远程仓库，或使用文件读取工具进行静态审计。'
          const parentId = header.parentSession || session.parentSession
          session = parentId && sessions?.get?.(parentId)
        }
        return undefined
      })
    }
    ctx.tools.register(defineTool({
      name: 'dsh_web_fuzzer',
      description: 'Run an authorized HTTP Web Fuzzer request matrix. Use {{name}} in method, URL, headers, or body and provide payloads.name as an array. Results are bounded and include response status, duration, and captured flow ids.',
      parameters: {
        request: { type: 'object', required: true, additionalProperties: true, description: 'Request template: method, url, headers JSON object or JSON string, and body.' },
        enabled: { type: 'boolean', description: 'Whether this Web Fuzzer instance is enabled.' },
        payloads: { type: 'object', additionalProperties: true, description: 'Map of placeholder names to arrays of replacement values.' },
        maxCases: { type: 'number', description: 'Maximum cases, capped at 500.' },
        concurrency: { type: 'number', description: 'Concurrent requests, capped at 16.' },
        timeoutMs: { type: 'number', description: 'Per-request timeout.' },
        network: { type: 'object', additionalProperties: true, description: 'Optional network settings: proxyUrl (HTTP/HTTPS/SOCKS5), ca/cert/key PEM, rejectUnauthorized, and forceHttps. HTTPS CONNECT through the built-in proxy remains TCP passthrough.' },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(args, exec) {
        return runtime.runFuzzer(args, exec.signal)
      },
    }))
    ctx.tools.register(defineTool({
      name: 'dsh_mitm_capture',
      description: 'Control the local Web Testing HTTP proxy, configure manual request/response interception, inspect captured flows, and review HaE highlights. HTTPS CONNECT entries are metadata-only TCP tunnels in this version.',
      parameters: {
        action: { type: 'string', required: true, enum: ['status', 'start', 'stop', 'list', 'detail', 'clear', 'rules', 'setRule', 'removeRule', 'config', 'setConfig', 'flowAction'] },
        id: { type: 'string', description: 'Flow id for detail or flowAction.' },
        limit: { type: 'number', description: 'List size, capped at 500.' },
        host: { type: 'string', description: 'Proxy listen host for start.' },
        port: { type: 'number', description: 'Proxy listen port; 0 selects a free port.' },
        rule: { type: 'object', additionalProperties: true, description: 'Rule for rules action: id, match, and action ({type:block|replace}).' },
        config: { type: 'object', additionalProperties: true, description: 'MITM config: mode, interceptRoutes, interceptSuffixes, autoReleaseRules, holdResponse, and haeRules.' },
        payload: { type: 'object', additionalProperties: true, description: 'Flow action payload, such as release-request, release-response, replace-response, or drop-response.' },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(args) {
        const action = String(args.action)
        if (action === 'status') return { ok: true, proxy: runtime.state.endpoint || null, proxyError: runtime.state.proxyError || null, flowCount: runtime.state.flows.length, pendingCount: runtime.state.pending.size, config, mitm: runtime.state.mitm }
        if (action === 'start') return { ok: true, proxy: await runtime.startProxy({ host: args.host, port: args.port }) }
        if (action === 'stop') { await runtime.stopProxy(); return { ok: true } }
        if (action === 'clear') {
          dropAllPending(runtime.state, '流量已清空')
          runtime.state.flows.length = 0
          return { ok: true }
        }
        if (action === 'config') return { ok: true, mitm: runtime.state.mitm }
        if (action === 'setConfig') {
          runtime.state.mitm = mergeMitmConfig(runtime.state.mitm, args.config || {})
          const released = reconcilePendingInterceptions(runtime.state)
          refreshHaeHighlights(runtime.state)
          return { ok: true, mitm: runtime.state.mitm, released }
        }
        if (action === 'flowAction') return { ok: true, flow: publicFlow(resolveFlowAction(runtime.state, args.id, args.payload || {}), true) }
        if (action === 'rules') return { ok: true, rules: runtime.state.rules }
        if (action === 'setRule') {
          const rule = { ...(args.rule || {}), id: String(args.rule?.id || `rule_${Date.now().toString(36)}`) }
          const index = runtime.state.rules.findIndex(item => item.id === rule.id)
          if (index >= 0) runtime.state.rules[index] = rule
          else runtime.state.rules.push(rule)
          return { ok: true, rule }
        }
        if (action === 'removeRule') {
          const id = String(args.id || '')
          runtime.state.rules = runtime.state.rules.filter(item => item.id !== id)
          return { ok: true }
        }
        if (action === 'list') return { ok: true, flows: runtime.state.flows.slice(0, clampInt(args.limit, 100, 1, 500)).map(flow => publicFlow(flow)) }
        if (action === 'detail') {
          const flow = runtime.state.flows.find(item => item.id === String(args.id || ''))
          if (!flow) throw new Error('flow 不存在')
          return { ok: true, flow: publicFlow(flow, true) }
        }
        throw new Error(`不支持的 action: ${action}`)
      },
    }))
  }

  ctx.effect(() => {
    const autoStart = config.autoStart
      ? runtime.startProxy().catch(error => {
          runtime.state.proxyError = String(error?.message || error)
          return undefined
        })
      : Promise.resolve()
    return async () => {
      await autoStart.catch(() => {})
      await runtime.stopProxy()
    }
  }, 'dsh-web-testing: proxy lifecycle')
}

export { normalizeConfig, publicFlow, requestSpec }
