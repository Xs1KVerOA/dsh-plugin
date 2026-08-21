import Schema from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import { readSignedCookie, signCookiePayload } from './cookie.js'

export const name = 'dsh-dex'
export const inject = ['webServer', 'credentials', 'storageDomain', 'apiProxy']

export const Config = Schema.object({
  issuer: Schema.string().required(),
  clientId: Schema.string().required(),
  clientSecretRef: Schema.string().default('DEX_DSH_CLIENT_SECRET'),
  cookieSecretRef: Schema.string().default('DSH_DEX_COOKIE_SECRET'),
  publicBaseUrl: Schema.string().required(),
  redirectPath: Schema.string().default('/auth/callback'),
  userRoot: Schema.string().required(),
  cookieName: Schema.string().default('dsh_session'),
  oidcStateCookieName: Schema.string().default('dsh_oidc_state'),
  cookieTtlSeconds: Schema.number().min(300).max(7 * 24 * 60 * 60).default(8 * 60 * 60),
  cookieSecure: Schema.boolean().default(false),
  allowedGroups: Schema.array(Schema.string()).default([]),
  adminGroups: Schema.array(Schema.string()).default([]),
  adminUsers: Schema.array(Schema.string()).default([]),
  discoveryCacheMs: Schema.number().min(1000).max(24 * 60 * 60 * 1000).default(5 * 60 * 1000),
  maxClockSkewSeconds: Schema.number().min(0).max(300).default(30),
})

const OWNER_VERSION = 1
const PUBLIC_PATHS = new Set([
  '/auth/login',
  '/auth/callback',
  '/auth/logout',
  '/auth/session',
  '/auth/client.js',
  '/auth/health',
  '/favicon.svg',
  '/manifest.webmanifest',
])
const PRIVILEGED_ENDPOINTS = new Set([
  'host.openPath',
  'settings.openDocument',
  'settings.update',
  'settings.replace',
  'settings.mutate',
  'credentials.set',
  'credentials.unset',
  'llm.discoverModels',
  'agentPreset.read',
  'agentPreset.copy',
  'agentPreset.openDocument',
  'agentPreset.remove',
])
const RESPONSE_BODY_ENDPOINTS = new Set([
  'settings.describe',
  'session.create',
  'session.fork',
  'session.list',
  'session.search',
  'workspace.create',
  'workspace.list',
  'subagent.list',
  'host.listDirectory',
  'host.pickDirectory',
])
const USER_SCOPED_HOST_ENDPOINTS = new Set([
  'host.describe',
  'host.pickDirectory',
  'host.listDirectory',
  'host.createDirectory',
])
const MODEL_SETTINGS_NAMESPACES = new Set(['llm-deepseek', 'llm-pi-ai'])
const EXPOSED_CREDENTIAL_REFS = new Set(['DEEPSEEK_API_KEY', 'DEEPSEEK_OFFICIAL_API_KEY'])

const OWNER_RECORD = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
})

const DEFAULT_WORKSPACE_RECORD = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
})

export const dexDomain = defineDomain({
  name: 'dsh_dex',
  version: OWNER_VERSION,
  tables: {
    session_owners: domainTable(OWNER_RECORD),
    workspace_owners: domainTable(OWNER_RECORD),
    default_workspaces: domainTable(DEFAULT_WORKSPACE_RECORD),
  },
})

function normalizeConfig(input) {
  const config = input ?? {}
  const issuer = String(config.issuer ?? '').replace(/\/+$/, '')
  const publicBaseUrl = String(config.publicBaseUrl ?? '').replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(issuer)) throw new Error('dsh-dex: issuer must be an absolute http(s) URL')
  if (!/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(publicBaseUrl)) throw new Error('dsh-dex: publicBaseUrl must be an absolute http(s) URL')
  const redirectPath = String(config.redirectPath ?? '/auth/callback')
  if (!/^\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(redirectPath) || redirectPath.includes('..')) {
    throw new Error('dsh-dex: redirectPath must be a safe absolute path')
  }
  const cookieName = String(config.cookieName ?? 'dsh_session')
  const stateCookieName = String(config.oidcStateCookieName ?? 'dsh_oidc_state')
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(cookieName) || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(stateCookieName)) {
    throw new Error('dsh-dex: cookie names are invalid')
  }
  const allowedGroups = normalizeList(config.allowedGroups)
  const adminGroups = normalizeList(config.adminGroups)
  const adminUsers = normalizeList(config.adminUsers)
  return {
    issuer,
    clientId: String(config.clientId ?? '').trim(),
    clientSecretRef: String(config.clientSecretRef ?? 'DEX_DSH_CLIENT_SECRET').trim(),
    cookieSecretRef: String(config.cookieSecretRef ?? 'DSH_DEX_COOKIE_SECRET').trim(),
    publicBaseUrl,
    redirectPath,
    userRoot: resolve(String(config.userRoot ?? '')),
    cookieName,
    stateCookieName,
    cookieTtlSeconds: Number(config.cookieTtlSeconds ?? 8 * 60 * 60),
    cookieSecure: config.cookieSecure === true,
    allowedGroups,
    adminGroups,
    adminUsers,
    discoveryCacheMs: Number(config.discoveryCacheMs ?? 5 * 60 * 1000),
    maxClockSkewSeconds: Number(config.maxClockSkewSeconds ?? 30),
  }
}

function normalizeList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(item => String(item).trim()).filter(Boolean))]
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url')
}

function jsonResponse(res, status, body, headers = {}) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

function redirectResponse(res, location, headers = {}) {
  res.writeHead(302, { location, 'cache-control': 'no-store', ...headers })
  res.end()
}

function parseCookies(header) {
  const cookies = new Map()
  for (const part of String(header ?? '').split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (!key) continue
    try { cookies.set(key, decodeURIComponent(value)) } catch { /* malformed cookie */ }
  }
  return cookies
}

function cookieHeader(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`, `SameSite=${options.sameSite ?? 'Lax'}`]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${String(options.maxAge)}`)
  if (options.httpOnly !== false) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

function clearCookie(name, secure) {
  return cookieHeader(name, '', { maxAge: 0, secure })
}

function safeReturnTo(raw) {
  const value = String(raw ?? '/').trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\0') || value.length > 2048) return '/'
  return value
}

function publicRedirectUri(config) {
  return new URL(config.redirectPath, `${config.publicBaseUrl}/`).toString()
}

function pkceChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url')
}

function requestFromNode(req) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers ?? {})) {
    if (typeof value === 'string') headers.set(name, value)
    else if (Array.isArray(value)) headers.set(name, value.join(', '))
  }
  return new Request(`http://${req.headers?.host ?? 'dsh.invalid'}${req.url ?? '/'}`, { method: req.method ?? 'GET', headers })
}

function unauthorizedResponse() {
  return new Response(JSON.stringify({ ok: false, error: 'authentication required' }), {
    status: 401,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'www-authenticate': 'Bearer' },
  })
}

function forbiddenResponse(message = 'forbidden') {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status: 403,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function ownerKey(value) {
  return String(value ?? '').trim()
}

function userDirectoryName(principal) {
  const source = ownerKey(principal.username) || ownerKey(principal.sub)
  const safe = source
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._@-]+/gu, '_')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 128)
  if (safe && safe !== '.' && safe !== '..') return safe
  return createHash('sha256').update(ownerKey(principal.sub)).digest('hex').slice(0, 32)
}

function userRootFor(config, principal) {
  return resolve(config.userRoot, userDirectoryName(principal))
}

function pathInside(root, target) {
  const remainder = relative(resolve(root), resolve(target))
  return remainder === '' || (remainder !== '..' && !remainder.startsWith(`..${sep}`) && !/^[A-Za-z]:/i.test(remainder))
}

function userHostPath(config, principal, rawPath) {
  const root = userRootFor(config, principal)
  const value = typeof rawPath === 'string' ? rawPath.trim() : ''
  const target = value === '' ? root : resolve(value)
  return pathInside(root, target) ? { root, target } : undefined
}

class OwnerStore {
  constructor(ctx) {
    this.ctx = ctx
    this.domainPromise = undefined
    this.tables = { session: undefined, workspace: undefined, defaultWorkspace: undefined }
    this.pending = new Map()
    this.pendingOwners = new Map()
    this.ready = this.load()
  }

  async load() {
    const domain = await this.domain()
    this.tables.session = domain.table('session_owners')
    this.tables.workspace = domain.table('workspace_owners')
    this.tables.defaultWorkspace = domain.table('default_workspaces')
  }

  domain() {
    return this.domainPromise ??= this.ctx.storageDomain.open(dexDomain)
  }

  async owner(kind, id) {
    await this.ready
    const key = ownerKey(id)
    return this.pendingOwners.get(`${kind}:${key}`) ?? this.tables[kind].get(key)?.owner
  }

  ownerSync(kind, id) {
    const key = ownerKey(id)
    return this.pendingOwners.get(`${kind}:${key}`) ?? this.tables[kind]?.get(key)?.owner
  }

  async defaultWorkspace(owner) {
    await this.ready
    return this.tables.defaultWorkspace.get(ownerKey(owner))?.workspaceId
  }

  remember(kind, id, owner) {
    const key = ownerKey(id)
    const subject = ownerKey(owner)
    if (!key || !subject) return Promise.resolve(false)
    const pendingKey = `${kind}:${key}`
    const pending = this.pending.get(pendingKey)
    if (pending !== undefined) return pending.then(() => this.ownerSync(kind, key) === subject)
    const current = this.ownerSync(kind, key)
    if (current !== undefined) return Promise.resolve(current === subject)
    const record = { id: key, owner: subject, createdAt: Date.now() }
    this.pendingOwners.set(pendingKey, subject)
    const operation = (async () => {
      try {
        await this.ready
        await this.tables[kind].put(key, record)
        return true
      } catch (error) {
        if (this.pendingOwners.get(pendingKey) === subject) this.pendingOwners.delete(pendingKey)
        throw error
      } finally {
        if (this.pendingOwners.get(pendingKey) === subject) this.pendingOwners.delete(pendingKey)
        this.pending.delete(pendingKey)
      }
    })()
    this.pending.set(pendingKey, operation)
    return operation
  }

  rememberSoon(kind, id, owner) {
    void this.remember(kind, id, owner).catch(error => {
      this.ctx.logger.warn(`dsh-dex: failed to persist ${kind} ownership: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  async rememberDefault(owner, workspaceId) {
    const key = ownerKey(owner)
    const value = ownerKey(workspaceId)
    if (!key || !value) return false
    await this.ready
    const current = this.tables.defaultWorkspace.get(key)?.workspaceId
    if (current !== undefined) return current === value
    await this.tables.defaultWorkspace.put(key, { id: key, workspaceId: value, createdAt: Date.now() })
    return true
  }

  async close() {
    await Promise.allSettled([...this.pending.values()])
    if (this.domainPromise) {
      const domain = await this.domainPromise
      this.domainPromise = undefined
      await domain.close()
    }
  }
}

function principalClaims(claims) {
  const groups = Array.isArray(claims.groups)
    ? claims.groups.map(String)
    : typeof claims.groups === 'string' ? claims.groups.split(/[\s,]+/).filter(Boolean) : []
  const username = String(claims.preferred_username || claims.username || claims.name || claims.email || claims.sub || '').trim()
  return {
    sub: String(claims.sub ?? '').trim(),
    username,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    name: typeof claims.name === 'string' ? claims.name : username,
    groups: [...new Set(groups)],
  }
}

function isAdmin(config, principal) {
  return config.adminUsers.includes(principal.username)
    || principal.groups.some(group => config.adminGroups.includes(group))
}

function hasAllowedGroup(config, principal) {
  return config.allowedGroups.length === 0 || principal.groups.some(group => config.allowedGroups.includes(group))
}

function decodeJwtPart(part) {
  try {
    const value = JSON.parse(decodeBase64Url(part).toString('utf8'))
    return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined
  } catch {
    return undefined
  }
}

function parseJwt(token) {
  const parts = String(token).split('.')
  if (parts.length !== 3) throw new Error('OIDC id_token is not a compact JWT')
  const header = decodeJwtPart(parts[0])
  const payload = decodeJwtPart(parts[1])
  if (!header || !payload) throw new Error('OIDC id_token has invalid JSON')
  return { parts, header, payload }
}

async function fetchJson(url, init, signal) {
  const response = await fetch(url, { ...init, signal: signal ?? AbortSignal.timeout(15000) })
  const body = await response.text()
  let value
  try { value = body ? JSON.parse(body) : {} } catch { value = undefined }
  if (!response.ok || value === undefined) throw new Error(`OIDC endpoint returned HTTP ${String(response.status)}`)
  return value
}

class OidcClient {
  constructor(config, credentials) {
    this.config = config
    this.credentials = credentials
    this.discoveryValue = undefined
    this.discoveryAt = 0
    this.discoveryPromise = undefined
    this.jwksValue = undefined
    this.jwksAt = 0
    this.jwksPromise = undefined
  }

  async discovery() {
    if (this.discoveryValue !== undefined && Date.now() - this.discoveryAt < this.config.discoveryCacheMs) return this.discoveryValue
    if (this.discoveryPromise !== undefined) return this.discoveryPromise
    const promise = (async () => {
      const value = await fetchJson(`${this.config.issuer}/.well-known/openid-configuration`)
      if (value.issuer !== this.config.issuer) throw new Error('OIDC discovery issuer does not match configured issuer')
      for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
        if (typeof value[key] !== 'string') throw new Error(`OIDC discovery is missing ${key}`)
      }
      this.discoveryValue = value
      this.discoveryAt = Date.now()
      return value
    })()
    this.discoveryPromise = promise
    try {
      return await promise
    } finally {
      if (this.discoveryPromise === promise) this.discoveryPromise = undefined
    }
  }

  async jwks(uri) {
    if (this.jwksValue !== undefined && Date.now() - this.jwksAt < this.config.discoveryCacheMs) return this.jwksValue
    if (this.jwksPromise !== undefined) return this.jwksPromise
    const promise = (async () => {
      const value = await fetchJson(uri)
      if (!Array.isArray(value.keys)) throw new Error('OIDC JWKS response has no keys')
      this.jwksValue = value.keys
      this.jwksAt = Date.now()
      return this.jwksValue
    })()
    this.jwksPromise = promise
    try {
      return await promise
    } finally {
      if (this.jwksPromise === promise) this.jwksPromise = undefined
    }
  }

  async clientSecret() {
    const result = await this.credentials.resolve(credentialRef(this.config.clientSecretRef))
    if (!result?.value) throw new Error('Dex client secret is not configured')
    return result.value
  }

  async cookieSecret() {
    const result = await this.credentials.resolve(credentialRef(this.config.cookieSecretRef))
    if (!result?.value || Buffer.byteLength(result.value) < 32) throw new Error('DSH Dex cookie secret must be at least 32 bytes')
    return result.value
  }

  async authorizationUrl(state, nonce, verifier, returnTo) {
    const discovery = await this.discovery()
    const url = new URL(discovery.authorization_endpoint)
    url.searchParams.set('client_id', this.config.clientId)
    url.searchParams.set('redirect_uri', publicRedirectUri(this.config))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid profile email groups')
    url.searchParams.set('state', state)
    url.searchParams.set('nonce', nonce)
    url.searchParams.set('code_challenge', pkceChallenge(verifier))
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('return_to', returnTo)
    return url.toString()
  }

  async exchange(code, verifier) {
    const discovery = await this.discovery()
    const secret = await this.clientSecret()
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: publicRedirectUri(this.config),
      client_id: this.config.clientId,
      code_verifier: verifier,
    })
    const response = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${this.config.clientId}:${secret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(15000),
    })
    const raw = await response.text()
    let value
    try { value = JSON.parse(raw) } catch { value = undefined }
    if (!response.ok || !value?.id_token) throw new Error('OIDC code exchange failed')
    return { ...value, discovery }
  }

  async verifyIdToken(token, nonce) {
    const { parts, header, payload } = parseJwt(token)
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('OIDC id_token must use a named RS256 key')
    const keys = await this.jwks((await this.discovery()).jwks_uri)
    const jwk = keys.find(key => key?.kid === header.kid && key?.kty === 'RSA' && key?.n && key?.e)
    if (!jwk) {
      this.jwksValue = undefined
      this.jwksAt = 0
      throw new Error('OIDC id_token signing key is not published')
    }
    const key = createPublicKey({ key: jwk, format: 'jwk' })
    const valid = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), key, decodeBase64Url(parts[2]))
    if (!valid) throw new Error('OIDC id_token signature is invalid')
    const now = Math.floor(Date.now() / 1000)
    if (payload.iss !== this.config.issuer) throw new Error('OIDC id_token issuer is invalid')
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    if (!audience.includes(this.config.clientId)) throw new Error('OIDC id_token audience is invalid')
    if (typeof payload.exp !== 'number' || payload.exp < now - this.config.maxClockSkewSeconds) throw new Error('OIDC id_token is expired')
    if (typeof payload.iat !== 'number' || payload.iat > now + this.config.maxClockSkewSeconds) throw new Error('OIDC id_token issued-at is invalid')
    if (payload.nonce !== nonce) throw new Error('OIDC id_token nonce is invalid')
    const principal = principalClaims(payload)
    if (!principal.sub) throw new Error('OIDC id_token has no subject')
    return principal
  }
}

async function sessionPrincipal(request, oidc) {
  const cookies = parseCookies(request.headers.get('cookie'))
  const value = cookies.get(oidc.config.cookieName)
  if (!value) return undefined
  return readSignedCookie(value, await oidc.cookieSecret(), oidc.config)
}

function sessionCookie(config, principal, secret) {
  const now = Math.floor(Date.now() / 1000)
  return signCookiePayload({
    v: 1,
    sid: randomBytes(16).toString('hex'),
    sub: principal.sub,
    username: principal.username,
    preferred_username: principal.username,
    email: principal.email,
    name: principal.name,
    groups: principal.groups,
    iat: now,
    exp: now + config.cookieTtlSeconds,
  }, secret)
}

async function responseBody(response) {
  try { return await response.clone().json() } catch { return undefined }
}

function responseWithJson(response, body) {
  return new Response(JSON.stringify(body), {
    status: response.status,
    statusText: response.statusText,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function responseWithJsonIfChanged(response, original, body) {
  return body === original ? response : responseWithJson(response, body)
}

function filterModelSettings(body, principal, config) {
  if (!body?.result?.ok || isAdmin(config, principal)) return body
  const value = body.result.value
  return {
    ...body,
    result: {
      ...body.result,
      value: {
        ...value,
        writable: false,
        hasDocument: false,
        namespaces: Array.isArray(value?.namespaces)
          ? value.namespaces.filter(item => MODEL_SETTINGS_NAMESPACES.has(item?.ns))
          : [],
      },
    },
  }
}

function filterSessionList(body, principal, config, owners) {
  if (!body?.result?.ok || !Array.isArray(body.result.value?.items) || isAdmin(config, principal)) return body
  const items = []
  for (const item of body.result.value.items) {
    if (owners.ownerSync('session', item.sessionId) === principal.sub) items.push(item)
  }
  return { ...body, result: { ...body.result, value: { ...body.result.value, items } } }
}

function filterSearch(body, principal, config, owners) {
  if (!body?.result?.ok || !Array.isArray(body.result.value?.items) || isAdmin(config, principal)) return body
  const items = []
  for (const item of body.result.value.items) {
    if (owners.ownerSync('session', item.sessionId) === principal.sub) items.push(item)
  }
  return { ...body, result: { ...body.result, value: { ...body.result.value, items } } }
}

function filterWorkspace(body, principal, config, owners) {
  if (!body?.result?.ok || !Array.isArray(body.result.value?.items) || isAdmin(config, principal)) return body
  const root = userRootFor(config, principal)
  const items = []
  for (const item of body.result.value.items) {
    const workspaceOwner = owners.ownerSync('workspace', item.workspaceId)
    const underUserRoot = pathInside(root, item.path)
    const owned = workspaceOwner === principal.sub || underUserRoot
    if (!owned) continue
    // Workspaces created before the Dex ownership index was introduced are
    // still valid when their canonical path is inside this user's root.  Heal
    // the index while serving the baseline so a later session.create can use
    // the same workspaceId instead of snapping the picker back to empty.
    if (underUserRoot && workspaceOwner !== principal.sub) owners.rememberSoon('workspace', item.workspaceId, principal.sub)
    items.push({ ...item, sessionIds: (item.sessionIds ?? []).filter(id => owners.ownerSync('session', id) === principal.sub) })
  }
  const archivedSessionIds = (body.result.value.archivedSessionIds ?? []).filter(id => owners.ownerSync('session', id) === principal.sub)
  return { ...body, result: { ...body.result, value: { ...body.result.value, items, archivedSessionIds } } }
}

function filterSubagentList(body, principal, config, owners) {
  if (!body?.result?.ok || !Array.isArray(body.result.value?.entries) || isAdmin(config, principal)) return body
  const entries = []
  for (const item of body.result.value.entries) {
    if (owners.ownerSync('session', item.id) === principal.sub) entries.push(item)
  }
  return { ...body, result: { ...body.result, value: { ...body.result.value, entries } } }
}

function filterDirectoryListing(body, principal, config) {
  if (!body?.result?.ok || !body.result.value || isAdmin(config, principal)) return body
  const root = userRootFor(config, principal)
  const value = body.result.value
  const crumbs = Array.isArray(value.crumbs)
    ? value.crumbs.filter(item => typeof item?.path === 'string' && pathInside(root, item.path))
    : []
  if (!crumbs.some(item => resolve(item.path) === root)) crumbs.unshift({ name: root, path: root, hidden: false })
  return {
    ...body,
    result: {
      ...body.result,
      value: { ...value, home: root, crumbs },
    },
  }
}

function filterDirectoryPick(body, principal, config) {
  if (!body?.result?.ok || !body.result.value || isAdmin(config, principal)) return body
  const value = body.result.value
  if (typeof value.path !== 'string' || value.path === '' || pathInside(userRootFor(config, principal), value.path)) return body
  // The native picker has no root argument in the wire contract.  Treat an
  // outside-root selection as cancellation rather than exposing or adopting
  // a path the authenticated user is not allowed to use.
  return {
    ...body,
    result: { ...body.result, value: { ...value, path: null } },
  }
}

function sessionIdFromEndpoint(endpoint, payload) {
  if (payload && typeof payload === 'object') {
    for (const key of ['sessionId', 'parentSessionId', 'childSessionId']) {
      if (typeof payload[key] === 'string' && payload[key]) return payload[key]
    }
  }
  return undefined
}

function reject(message) {
  return { response: forbiddenResponse(message) }
}

function filterFrame(config, owners, principal, channel, frame) {
  if (isAdmin(config, principal)) return frame
  if (!frame || typeof frame !== 'object') return undefined
  if (frame.type === 'stream/error') return frame
  if (typeof frame.sessionId === 'string' && owners.ownerSync('session', frame.sessionId) === principal.sub) return frame
  if (channel === 'host' && frame.type === 'host/workspace-changed') {
    const workspace = frame.workspace
    if (workspace && (owners.ownerSync('workspace', workspace.workspaceId) === principal.sub || pathInside(userRootFor(config, principal), workspace.path))) {
      return { ...frame, workspace: { ...workspace, sessionIds: workspace.sessionIds.filter(id => owners.ownerSync('session', id) === principal.sub) } }
    }
  }
  if (channel === 'host' && frame.type === 'host/archived-sessions-changed') {
    return { ...frame, archivedSessionIds: frame.archivedSessionIds.filter(id => owners.ownerSync('session', id) === principal.sub) }
  }
  return undefined
}

function clientScript() {
  return `(() => {
  const installUuidFallback = () => {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi || typeof cryptoApi.randomUUID === 'function' || typeof cryptoApi.getRandomValues !== 'function') return;
    try {
      Object.defineProperty(cryptoApi, 'randomUUID', { configurable: true, value: () => {
        const bytes = new Uint8Array(16);
        cryptoApi.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
        return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
      }});
    } catch {}
  };
  installUuidFallback();
  const login = () => { const returnTo = location.pathname + location.search + location.hash; location.assign('/auth/login?returnTo=' + encodeURIComponent(returnTo)); };
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => { const response = await originalFetch(...args); if (response.status === 401 && location.pathname.indexOf('/auth/') !== 0) login(); return response; };
  let sessionState;
  let userCard;
  let renderQueued = false;
  let observerStarted = false;
  const findSettingsAnchor = () => {
    const marked = document.querySelector('button[data-dsh-settings-trigger="true"]');
    if (marked) {
      const rect = marked.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return marked;
    }
    const candidates = Array.from(document.querySelectorAll('button')).filter(button => {
      const label = [button.textContent || '', button.getAttribute('aria-label') || '', button.title || ''].join(' ');
      const rect = button.getBoundingClientRect();
      return button.getAttribute('aria-haspopup') === 'dialog' && /设置|settings/i.test(label) && rect.width > 0 && rect.height > 0;
    });
    return candidates.sort((left, right) => {
      const leftText = /^\s*(设置|settings)\s*$/i.test(left.textContent || '') ? 2 : (/设置|settings/i.test(left.textContent || '') ? 1 : 0);
      const rightText = /^\s*(设置|settings)\s*$/i.test(right.textContent || '') ? 2 : (/设置|settings/i.test(right.textContent || '') ? 1 : 0);
      if (leftText !== rightText) return rightText - leftText;
      return right.getBoundingClientRect().width - left.getBoundingClientRect().width;
    })[0];
  };
  const closeUserPopover = () => document.getElementById('dsh-dex-user-popover')?.remove();
  const normalizeSettingsLayout = (settingsButton, settingsParent) => {
    if (!settingsButton || !settingsParent) return;
    settingsParent.style.display = 'flex';
    settingsParent.style.alignItems = 'center';
    settingsParent.style.justifyContent = 'space-between';
    settingsParent.style.gap = '6px';
    settingsParent.style.width = '100%';
    settingsParent.style.minWidth = '0';
    settingsParent.style.boxSizing = 'border-box';
    settingsButton.style.flex = '1 1 auto';
    settingsButton.style.minWidth = '0';
    settingsButton.style.width = 'auto';
    settingsButton.style.boxSizing = 'border-box';
  };
  const renderUserInfo = () => {
    if (!sessionState?.authenticated || !document.body) return;
    const settingsButton = findSettingsAnchor();
    const settingsParent = settingsButton?.parentElement;
    // Never float the account card over the application while the shell is
    // still mounting or while an incompatible client lacks the stable
    // settings marker. Waiting for the real settings seat is safer than a
    // fixed fallback that can cover the composer and conversation content.
    if (!settingsButton || !settingsParent) {
      closeUserPopover();
      document.getElementById('dsh-dex-user-info')?.remove();
      userCard = undefined;
      return;
    }
    normalizeSettingsLayout(settingsButton, settingsParent);
    let card = document.getElementById('dsh-dex-user-info');
    const target = settingsParent;
    if (!card || card.parentElement !== target) {
      card?.remove();
      closeUserPopover();
      card = document.createElement('button');
      card.type = 'button';
      card.id = 'dsh-dex-user-info';
      card.setAttribute('data-dsh-user-info', 'true');
      card.style.cssText = 'appearance:none;display:flex;align-items:center;gap:6px;flex:0 0 128px;width:128px;min-width:128px;max-width:128px;box-sizing:border-box;margin:0 8px 0 0;padding:5px 7px;border:1px solid #e5e7eb;border-radius:8px;background:transparent;color:inherit;font:12px/1.35 system-ui,sans-serif;white-space:nowrap;text-align:left;overflow:hidden;cursor:pointer;';
      settingsParent.insertBefore(card, settingsButton);
      card.addEventListener('click', event => {
        event.stopPropagation();
        const existing = document.getElementById('dsh-dex-user-popover');
        if (existing) { existing.remove(); return; }
        const popup = document.createElement('div');
        popup.id = 'dsh-dex-user-popover';
        popup.style.cssText = 'position:fixed;z-index:2000;width:220px;box-sizing:border-box;padding:10px 11px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;box-shadow:0 10px 28px rgba(15,23,42,.16);font:12px/1.4 system-ui,sans-serif;color:#111827;';
        const rect = card.getBoundingClientRect();
        popup.style.left = Math.max(8, Math.min(window.innerWidth - 228, rect.right - 220)) + 'px';
        popup.style.top = Math.max(8, rect.top - 106) + 'px';
        const nameRow = document.createElement('div');
        nameRow.style.cssText = 'font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        const detailRow = document.createElement('div');
        detailRow.style.cssText = 'margin-top:3px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        const logout = document.createElement('button');
        logout.type = 'button';
        logout.textContent = '退出登录';
        logout.style.cssText = 'display:block;width:100%;margin-top:9px;padding:6px 8px;border:0;border-radius:6px;background:#f3f4f6;color:#374151;cursor:pointer;font:inherit;text-align:left;';
        logout.addEventListener('click', () => location.assign('/auth/logout'));
        popup.append(nameRow, detailRow, logout);
        document.body.appendChild(popup);
        const user = sessionState.user || {};
        const workspaceRoot = typeof user.workspaceRoot === 'string' ? user.workspaceRoot : '';
        const workspaceName = workspaceRoot.split('/').filter(Boolean).pop() || '';
        nameRow.textContent = user.name || user.username || user.email || '当前用户';
        detailRow.textContent = user.email || (workspaceName ? '工作区 · ' + workspaceName : '已登录');
      });
    }
    const user = sessionState.user || {};
    const name = user.name || user.username || user.email || '当前用户';
    const detail = user.email && user.email !== name ? user.email : (user.username && user.username !== name ? user.username : '');
    const workspaceRoot = typeof user.workspaceRoot === 'string' ? user.workspaceRoot : '';
    const workspaceName = workspaceRoot.split('/').filter(Boolean).pop() || '';
    const key = [name, detail, workspaceName, ...(Array.isArray(user.groups) ? user.groups : [])].join('\u0001');
    if (card.dataset.userKey === key) return;
    card.dataset.userKey = key;
    card.replaceChildren();
    const avatar = document.createElement('div');
    avatar.textContent = Array.from(name.trim())[0]?.toUpperCase() || 'U';
    avatar.style.cssText = 'display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;background:#eef2ff;color:#4f46e5;font-weight:700;font-size:11px;';
    card.appendChild(avatar);
    const content = document.createElement('div');
    content.style.cssText = 'min-width:0;flex:1;text-align:left;';
    const title = document.createElement('div');
    title.textContent = name;
    title.style.cssText = 'font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:inherit;';
    content.appendChild(title);
    card.appendChild(content);
    card.title = [name, detail, workspaceRoot, ...(Array.isArray(user.groups) ? user.groups : [])].filter(Boolean).join(' · ');
    card.setAttribute('aria-label', '用户：' + name);
    userCard = card;
  };
  const queueRender = () => {
    if (renderQueued || !sessionState?.authenticated) return;
    renderQueued = true;
    const run = () => { renderQueued = false; if (!userCard?.isConnected) userCard = undefined; renderUserInfo(); };
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
    else window.setTimeout(run, 0);
  };
  const observeShell = new MutationObserver(() => {
    if (!sessionState?.authenticated) return;
    const card = document.getElementById('dsh-dex-user-info');
    // Streaming conversation updates can mutate the body frequently.  Once
    // the card is attached, let the app keep rendering without rescanning all
    // buttons and forcing layout measurements on every mutation.  If the app
    // replaces the shell, the card disconnects and the next animation frame
    // repairs it.
    if (!card || !card.isConnected) queueRender();
  });
  const startShellObserver = () => {
    if (!document.body || observerStarted) return;
    observerStarted = true;
    observeShell.observe(document.body, { childList: true, subtree: true });
    queueRender();
  };
  const startAfterBody = () => {
    if (document.body) startShellObserver();
    else document.addEventListener('DOMContentLoaded', startShellObserver, { once: true });
  };
  originalFetch('/auth/session', { credentials: 'same-origin' }).then(response => response.json()).then(state => {
    sessionState = state;
    if (!state.authenticated) login();
    else { startAfterBody(); queueRender(); }
  }).catch(() => login());
})();`
}

function isPublicPath(pathname) {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/plugins/')
}

export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig)
  const owners = new OwnerStore(ctx)
  const oidc = new OidcClient(config, ctx.credentials)
  const states = new Map()
  const defaultWorkspacePromises = new Map()
  const secureCookie = config.cookieSecure || config.publicBaseUrl.startsWith('https:')
  const clientScriptText = clientScript()

  const ensureDefaultWorkspace = async (principal) => {
    const key = principal.sub
    const saved = await owners.defaultWorkspace(key)
    if (saved !== undefined) {
      await owners.remember('workspace', saved, key)
      return saved
    }
    const existing = defaultWorkspacePromises.get(key)
    if (existing !== undefined) return existing
    const promise = (async () => {
      const current = await owners.defaultWorkspace(key)
      if (current !== undefined) {
        await owners.remember('workspace', current, key)
        return current
      }
      const root = userRootFor(config, principal)
      await mkdir(root, { recursive: true, mode: 0o700 })
      const result = await ctx.apiProxy.workspace.create({
        type: 'client-request',
        rpcId: `dsh-dex-default-${createHash('sha256').update(key).digest('hex').slice(0, 24)}`,
        method: 'workspace.create',
        payload: { path: root },
      })
      if (result?.result?.ok && typeof result.result.value?.workspace?.workspaceId === 'string') {
        const workspaceId = result.result.value.workspace.workspaceId
        await owners.remember('workspace', workspaceId, principal.sub)
        await owners.rememberDefault(key, workspaceId)
        return workspaceId
      }
      return undefined
    })()
    defaultWorkspacePromises.set(key, promise)
    try {
      return await promise
    } finally {
      if (defaultWorkspacePromises.get(key) === promise) defaultWorkspacePromises.delete(key)
    }
  }

  // Expose the same verified Dex identity to host-side plugins.  Custom host
  // routes do not go through apiProxy, so they must use this boundary instead
  // of parsing the signed cookie or trusting a forwarded username themselves.
  const authenticateRequest = async (request) => {
    await owners.ready
    const normalized = request?.headers && typeof request.headers.get === 'function'
      ? request
      : requestFromNode(request)
    const principal = await sessionPrincipal(normalized, oidc)
    if (!principal || !hasAllowedGroup(config, principal)) return undefined
    return {
      ...principal,
      admin: isAdmin(config, principal),
      workspaceRoot: userRootFor(config, principal),
    }
  }

  ctx.provide('dshAuth', { authenticateRequest })

  const policy = {
    async authenticate(request) {
      try {
        const principal = await authenticateRequest(request)
        if (!principal) return { response: unauthorizedResponse() }
        return { principal }
      } catch (error) {
        ctx.logger.warn(`dsh-dex: authentication failed: ${error instanceof Error ? error.message : String(error)}`)
        return { response: unauthorizedResponse() }
      }
    },

    async authorize({ request, endpoint, payload, principal }) {
      const admin = isAdmin(config, principal)
      if (!admin && endpoint === 'host.listDirectory') {
        const scoped = userHostPath(config, principal, payload?.path)
        if (!scoped) return reject('directory is outside the authenticated user workspace')
        await mkdir(scoped.root, { recursive: true, mode: 0o700 })
        return { payload: { ...(payload ?? {}), path: scoped.target } }
      }
      if (!admin && endpoint === 'host.createDirectory') {
        const scoped = userHostPath(config, principal, payload?.path)
        if (!scoped) return reject('directory is outside the authenticated user workspace')
        const name = typeof payload?.name === 'string' ? payload.name : ''
        const target = resolve(scoped.target, name)
        if (!name.trim() || name === '.' || name === '..' || /[/\\]/.test(name) || !pathInside(scoped.root, target)) {
          return reject('directory is outside the authenticated user workspace')
        }
        await mkdir(scoped.root, { recursive: true, mode: 0o700 })
        return { payload: { ...(payload ?? {}), path: scoped.target } }
      }
      if (!admin && endpoint === 'settings.describe') return undefined
      if (!admin && endpoint === 'credentials.describe') {
        const refs = Array.isArray(payload?.refs) ? payload.refs : []
        return {
          payload: {
            ...(payload ?? {}),
            refs: refs.filter(ref => EXPOSED_CREDENTIAL_REFS.has(ref)),
          },
        }
      }
      if (PRIVILEGED_ENDPOINTS.has(endpoint) || (endpoint.startsWith('host.') && !USER_SCOPED_HOST_ENDPOINTS.has(endpoint))) {
        if (!admin) return reject('this operation requires a Dex admin')
      }
      if (endpoint.startsWith('settings.') || endpoint.startsWith('credentials.')) {
        if (!admin) return reject('shared host configuration is admin-only')
      }
      const sessionId = sessionIdFromEndpoint(endpoint, payload)
      if (sessionId !== undefined && endpoint !== 'session.create' && !admin && await owners.owner('session', sessionId) !== principal.sub) {
        return reject('session does not belong to the authenticated user')
      }
      if (endpoint === 'session.create') {
        await mkdir(userRootFor(config, principal), { recursive: true, mode: 0o700 })
        const next = { ...(payload ?? {}) }
        if (next.workspaceId !== undefined && !admin && await owners.owner('workspace', next.workspaceId) !== principal.sub) {
          return reject('workspace does not belong to the authenticated user')
        }
        if (next.workspaceId === undefined) next.cwd = userRootFor(config, principal)
        return { payload: next }
      }
      if (endpoint === 'workspace.create') {
        if (admin) return undefined
        const scoped = userHostPath(config, principal, payload?.path)
        if (!scoped) return reject('workspace is outside the authenticated user workspace')
        await mkdir(userRootFor(config, principal), { recursive: true, mode: 0o700 })
        return { payload: { ...(payload ?? {}), path: scoped.target } }
      }
      if (endpoint.startsWith('workspace.') && endpoint !== 'workspace.list' && !admin) {
        const workspaceId = payload?.workspaceId
        if (typeof workspaceId === 'string' && await owners.owner('workspace', workspaceId) !== principal.sub) return reject('workspace does not belong to the authenticated user')
      }
      if (endpoint.startsWith('subagent.') && !admin) {
        for (const id of [payload?.parentSessionId, payload?.childSessionId].filter(value => typeof value === 'string')) {
          if (await owners.owner('session', id) !== principal.sub) return reject('subagent does not belong to the authenticated user')
        }
      }
      if (endpoint === 'agentPreset.select' && !admin && await owners.owner('session', payload?.sessionId) !== principal.sub) return reject('session does not belong to the authenticated user')
      return undefined
    },

    async transformResponse({ endpoint, principal, response }) {
      if (response.status < 200 || response.status >= 300) return response
      const body = RESPONSE_BODY_ENDPOINTS.has(endpoint) ? await responseBody(response) : undefined
      if (endpoint === 'session.create' || endpoint === 'session.fork') {
        const id = body?.result?.value?.sessionId
        if (body?.result?.ok && typeof id === 'string') await owners.remember('session', id, principal.sub)
      }
      if (body === undefined) return response
      if (endpoint === 'settings.describe') return responseWithJsonIfChanged(response, body, filterModelSettings(body, principal, config))
      if (endpoint === 'session.list') return responseWithJsonIfChanged(response, body, filterSessionList(body, principal, config, owners))
      if (endpoint === 'session.search') return responseWithJsonIfChanged(response, body, filterSearch(body, principal, config, owners))
      if (endpoint === 'workspace.list') return responseWithJsonIfChanged(response, body, filterWorkspace(body, principal, config, owners))
      if (endpoint === 'subagent.list') return responseWithJsonIfChanged(response, body, filterSubagentList(body, principal, config, owners))
      if (endpoint === 'host.listDirectory') return responseWithJsonIfChanged(response, body, filterDirectoryListing(body, principal, config))
      if (endpoint === 'host.pickDirectory') return responseWithJsonIfChanged(response, body, filterDirectoryPick(body, principal, config))
      if (endpoint === 'workspace.create' && body?.result?.ok && typeof body.result.value?.workspace?.workspaceId === 'string') {
        await owners.remember('workspace', body.result.value.workspace.workspaceId, principal.sub)
      }
      return response
    },

    filterFrame({ principal, channel, frame }) {
      return filterFrame(config, owners, principal, channel, frame)
    },
  }

  ctx.provide('apiRequestPolicy', policy)

  ctx.effect(() => ctx.webServer.registerRequestGuard(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://dsh.invalid').pathname
    // The API carrier invokes apiRequestPolicy itself.  Avoid authenticating
    // the same HTTP request once here and once again inside the carrier.
    if (isPublicPath(pathname) || pathname === '/api' || pathname.startsWith('/api/')) return false
    try {
      if (await authenticateRequest(req)) return false
    } catch {
      // The API policy and login callback still produce the user-visible error.
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      const returnTo = safeReturnTo(pathname + (new URL(req.url ?? '/', 'http://dsh.invalid').search || ''))
      redirectResponse(res, `/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
    } else {
      res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end('authentication required')
    }
    return true
  }), 'dsh-dex: request guard')

  const routes = [
    {
      path: '/auth/login',
      handler: async (req, res) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
        try {
          const state = randomBytes(24).toString('base64url')
          const nonce = randomBytes(24).toString('base64url')
          const verifier = randomBytes(48).toString('base64url')
          const returnTo = safeReturnTo(new URL(req.url ?? '/', 'http://dsh.invalid').searchParams.get('returnTo'))
          states.set(state, { nonce, verifier, returnTo, expiresAt: Date.now() + 10 * 60 * 1000 })
          const location = await oidc.authorizationUrl(state, nonce, verifier, returnTo)
          redirectResponse(res, location, { 'set-cookie': cookieHeader(config.stateCookieName, state, { maxAge: 600, secure: secureCookie }) })
        } catch (error) {
          jsonResponse(res, 502, { error: 'OIDC discovery unavailable' })
          ctx.logger.warn(`dsh-dex: login initialization failed: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    },
    {
      path: config.redirectPath,
      handler: async (req, res) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
        const url = new URL(req.url ?? '/', 'http://dsh.invalid')
        const state = url.searchParams.get('state') ?? ''
        const code = url.searchParams.get('code') ?? ''
        const stored = states.get(state)
        states.delete(state)
        if (!stored || stored.expiresAt < Date.now() || parseCookies(req.headers.cookie).get(config.stateCookieName) !== state || !code) {
          return jsonResponse(res, 400, { error: 'invalid OIDC callback state' }, { 'set-cookie': clearCookie(config.stateCookieName, secureCookie) })
        }
        try {
          const token = await oidc.exchange(code, stored.verifier)
          const principal = await oidc.verifyIdToken(token.id_token, stored.nonce)
          if (!hasAllowedGroup(config, principal)) return jsonResponse(res, 403, { error: 'user is not in an allowed Dex group' })
          const cookie = sessionCookie(config, principal, await oidc.cookieSecret())
          redirectResponse(res, stored.returnTo, {
            'set-cookie': [
              cookieHeader(config.stateCookieName, '', { maxAge: 0, secure: secureCookie }),
              cookieHeader(config.cookieName, cookie, { maxAge: config.cookieTtlSeconds, secure: secureCookie }),
            ],
          })
        } catch (error) {
          ctx.logger.warn(`dsh-dex: OIDC callback failed: ${error instanceof Error ? error.message : String(error)}`)
          jsonResponse(res, 502, { error: 'OIDC authentication failed' }, { 'set-cookie': clearCookie(config.stateCookieName, secureCookie) })
        }
      },
    },
    {
      path: '/auth/logout',
      handler: (req, res) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
        redirectResponse(res, '/', {
          'set-cookie': [clearCookie(config.cookieName, secureCookie), clearCookie(config.stateCookieName, secureCookie)],
        })
      },
    },
    {
      path: '/auth/session',
      handler: async (req, res) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
        const principal = await sessionPrincipal(requestFromNode(req), oidc).catch(() => undefined)
        if (!principal || !hasAllowedGroup(config, principal)) return jsonResponse(res, 200, { authenticated: false })
        try {
          await ensureDefaultWorkspace(principal)
        } catch (error) {
          ctx.logger.warn(`dsh-dex: default workspace initialization failed: ${error instanceof Error ? error.message : String(error)}`)
          return jsonResponse(res, 503, { authenticated: true, error: 'default workspace initialization failed' })
        }
        return jsonResponse(res, 200, { authenticated: true, user: { username: principal.username, email: principal.email, name: principal.name, groups: principal.groups, workspaceRoot: userRootFor(config, principal) } })
      },
    },
    {
      path: '/auth/client.js',
      handler: (req, res) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(clientScriptText) })
        res.end(clientScriptText)
      },
    },
    {
      path: '/auth/health',
      handler: (req, res) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
        jsonResponse(res, 200, { ok: true, issuer: config.issuer, clientId: config.clientId, redirectUri: publicRedirectUri(config) })
      },
    },
  ]
  for (const route of routes) ctx.effect(() => ctx.webServer.register({ kind: 'exact', ...route }), `dsh-dex: ${route.path}`)

  ctx.effect(() => ctx.webServer.tapIndex(html => html.includes('/auth/client.js') ? html : html.replace('</head>', '<script src="/auth/client.js" defer></script></head>')), 'dsh-dex: client bootstrap')

  ctx.on('session/created', session => {
    const parent = session.header.parentSession
    if (!parent) return
    const owner = owners.ownerSync('session', parent)
    if (owner) void owners.remember('session', session.id, owner)
  })
  ctx.effect(() => async () => {
    for (const [state, value] of states) if (value.expiresAt < Date.now()) states.delete(state)
    await owners.close()
  }, 'dsh-dex: state and ownership cleanup')
}

export default { name, inject, Config, apply }
