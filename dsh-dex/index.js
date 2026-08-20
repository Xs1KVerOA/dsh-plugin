import Schema from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import { readSignedCookie, signCookiePayload } from './cookie.js'

export const name = 'dsh-dex'
export const inject = ['webServer', 'credentials', 'storageDomain']

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
  'host.pickDirectory',
  'host.openPath',
  'settings.describe',
  'settings.openDocument',
  'settings.update',
  'settings.replace',
  'settings.mutate',
  'credentials.describe',
  'credentials.set',
  'credentials.unset',
  'llm.discoverModels',
  'agentPreset.read',
  'agentPreset.copy',
  'agentPreset.openDocument',
  'agentPreset.remove',
])

const OWNER_RECORD = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
})

export const dexDomain = defineDomain({
  name: 'dsh_dex',
  version: OWNER_VERSION,
  tables: {
    session_owners: domainTable(OWNER_RECORD),
    workspace_owners: domainTable(OWNER_RECORD),
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
  const target = rawPath === undefined ? root : resolve(String(rawPath))
  return pathInside(root, target) ? { root, target } : undefined
}

class OwnerStore {
  constructor(ctx) {
    this.ctx = ctx
    this.domainPromise = undefined
    this.cache = { session: new Map(), workspace: new Map() }
    this.ready = this.load()
  }

  async load() {
    const domain = await this.domain()
    for (const [id, record] of domain.table('session_owners').entries()) this.cache.session.set(id, record.owner)
    for (const [id, record] of domain.table('workspace_owners').entries()) this.cache.workspace.set(id, record.owner)
  }

  domain() {
    return this.domainPromise ??= this.ctx.storageDomain.open(dexDomain)
  }

  async owner(kind, id) {
    await this.ready
    return this.cache[kind].get(ownerKey(id))
  }

  ownerSync(kind, id) {
    return this.cache[kind].get(ownerKey(id))
  }

  async remember(kind, id, owner) {
    const key = ownerKey(id)
    const subject = ownerKey(owner)
    if (!key || !subject) return false
    await this.ready
    const current = this.cache[kind].get(key)
    if (current !== undefined) return current === subject
    const record = { id: key, owner: subject, createdAt: Date.now() }
    await (await this.domain()).table(kind === 'session' ? 'session_owners' : 'workspace_owners').put(key, record)
    this.cache[kind].set(key, subject)
    return true
  }

  async close() {
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
    this.jwksValue = undefined
    this.jwksAt = 0
  }

  async discovery() {
    if (this.discoveryValue !== undefined && Date.now() - this.discoveryAt < this.config.discoveryCacheMs) return this.discoveryValue
    const value = await fetchJson(`${this.config.issuer}/.well-known/openid-configuration`)
    if (value.issuer !== this.config.issuer) throw new Error('OIDC discovery issuer does not match configured issuer')
    for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri']) {
      if (typeof value[key] !== 'string') throw new Error(`OIDC discovery is missing ${key}`)
    }
    this.discoveryValue = value
    this.discoveryAt = Date.now()
    return value
  }

  async jwks(uri) {
    if (this.jwksValue !== undefined && Date.now() - this.jwksAt < this.config.discoveryCacheMs) return this.jwksValue
    const value = await fetchJson(uri)
    if (!Array.isArray(value.keys)) throw new Error('OIDC JWKS response has no keys')
    this.jwksValue = value.keys
    this.jwksAt = Date.now()
    return this.jwksValue
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

async function filterSessionList(body, principal, config, owners) {
  if (!body?.result?.ok || !Array.isArray(body.result.value?.items) || isAdmin(config, principal)) return body
  const items = []
  for (const item of body.result.value.items) {
    if (await owners.owner('session', item.sessionId) === principal.sub) items.push(item)
  }
  return { ...body, result: { ...body.result, value: { ...body.result.value, items } } }
}

async function filterSearch(body, principal, config, owners) {
  if (!body?.result?.ok || !Array.isArray(body.result.value?.items) || isAdmin(config, principal)) return body
  const items = []
  for (const item of body.result.value.items) {
    if (await owners.owner('session', item.sessionId) === principal.sub) items.push(item)
  }
  return { ...body, result: { ...body.result, value: { ...body.result.value, items } } }
}

async function filterWorkspace(body, principal, config, owners) {
  if (!body?.result?.ok || !Array.isArray(body.result.value?.items) || isAdmin(config, principal)) return body
  const items = []
  for (const item of body.result.value.items) {
    const workspaceOwner = await owners.owner('workspace', item.workspaceId)
    const owned = workspaceOwner === principal.sub || pathInside(userRootFor(config, principal), item.path)
    if (!owned) continue
    items.push({ ...item, sessionIds: (item.sessionIds ?? []).filter(id => owners.ownerSync('session', id) === principal.sub) })
  }
  const archivedSessionIds = (body.result.value.archivedSessionIds ?? []).filter(id => owners.ownerSync('session', id) === principal.sub)
  return { ...body, result: { ...body.result, value: { ...body.result.value, items, archivedSessionIds } } }
}

async function filterSubagentList(body, principal, config, owners) {
  if (!body?.result?.ok || !Array.isArray(body.result.value?.entries) || isAdmin(config, principal)) return body
  const entries = []
  for (const item of body.result.value.entries) {
    if (await owners.owner('session', item.id) === principal.sub) entries.push(item)
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
  const renderUserInfo = () => {
    const settingsButton = document.querySelector('button[aria-haspopup="dialog"]');
    const parent = settingsButton?.parentElement;
    if (!parent || !sessionState?.authenticated) return;
    let card = document.getElementById('dsh-dex-user-info');
    if (!card || card.parentElement !== parent) {
      card?.remove();
      card = document.createElement('div');
      card.id = 'dsh-dex-user-info';
      card.setAttribute('data-dsh-user-info', 'true');
      card.style.cssText = 'margin:0 12px 8px;padding:9px 11px;border:1px solid rgba(0,0,0,.10);border-radius:10px;background:rgba(255,255,255,.72);font:12px/1.45 system-ui,sans-serif;overflow:hidden;';
      parent.insertBefore(card, settingsButton);
    }
    const user = sessionState.user || {};
    const name = user.name || user.username || user.email || '当前用户';
    const detail = user.email && user.email !== name ? user.email : (user.username && user.username !== name ? user.username : '');
    const key = [name, detail, ...(Array.isArray(user.groups) ? user.groups : [])].join('\u0001');
    if (card.dataset.userKey === key) return;
    card.dataset.userKey = key;
    card.replaceChildren();
    const title = document.createElement('div');
    title.textContent = name;
    title.style.cssText = 'font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    card.appendChild(title);
    if (detail) {
      const subtitle = document.createElement('div');
      subtitle.textContent = detail;
      subtitle.style.cssText = 'color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      card.appendChild(subtitle);
    }
    card.title = [name, detail, ...(Array.isArray(user.groups) ? user.groups : [])].filter(Boolean).join(' · ');
  };
  const observeShell = new MutationObserver(renderUserInfo);
  const startShellObserver = () => { if (document.body) observeShell.observe(document.body, { childList: true, subtree: true }); renderUserInfo(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startShellObserver, { once: true }); else startShellObserver();
  originalFetch('/auth/session', { credentials: 'same-origin' }).then(response => response.json()).then(state => { sessionState = state; if (!state.authenticated) login(); else renderUserInfo(); }).catch(() => login());
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
  const secureCookie = config.cookieSecure || config.publicBaseUrl.startsWith('https:')

  const rememberSessionFromResponse = async (principal, endpoint, response) => {
    if (!principal || !['session.create', 'session.fork'].includes(endpoint)) return
    const body = await responseBody(response)
    const id = body?.result?.value?.sessionId
    if (body?.result?.ok && typeof id === 'string') await owners.remember('session', id, principal.sub)
  }

  const policy = {
    async authenticate(request) {
      try {
        await owners.ready
        const principal = await sessionPrincipal(request, oidc)
        if (!principal || !hasAllowedGroup(config, principal)) return { response: unauthorizedResponse() }
        await mkdir(userRootFor(config, principal), { recursive: true, mode: 0o700 })
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
        await mkdir(scoped.root, { recursive: true, mode: 0o700 })
        return { payload: { ...(payload ?? {}), path: scoped.target } }
      }
      if (PRIVILEGED_ENDPOINTS.has(endpoint) || (endpoint.startsWith('host.') && !['host.describe', 'host.listDirectory', 'host.createDirectory'].includes(endpoint))) {
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
        const next = { ...(payload ?? {}), cwd: userRootFor(config, principal) }
        if (next.workspaceId !== undefined && !admin && await owners.owner('workspace', next.workspaceId) !== principal.sub) {
          return reject('workspace does not belong to the authenticated user')
        }
        return { payload: next }
      }
      if (endpoint === 'workspace.create') {
        await mkdir(userRootFor(config, principal), { recursive: true, mode: 0o700 })
        return { payload: { path: userRootFor(config, principal) } }
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
      await rememberSessionFromResponse(principal, endpoint, response)
      const body = await responseBody(response)
      if (body === undefined) return response
      if (endpoint === 'session.list') return responseWithJson(response, await filterSessionList(body, principal, config, owners))
      if (endpoint === 'session.search') return responseWithJson(response, await filterSearch(body, principal, config, owners))
      if (endpoint === 'workspace.list') return responseWithJson(response, await filterWorkspace(body, principal, config, owners))
      if (endpoint === 'subagent.list') return responseWithJson(response, await filterSubagentList(body, principal, config, owners))
      if (endpoint === 'host.listDirectory') return responseWithJson(response, filterDirectoryListing(body, principal, config))
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
    if (isPublicPath(pathname) || pathname.startsWith('/api/')) return false
    try {
      const principal = await sessionPrincipal(requestFromNode(req), oidc)
      if (principal && hasAllowedGroup(config, principal)) return false
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

  ctx.effect(() => ctx.webServer.registerUpgradeGuard(async (req, socket) => {
    const pathname = new URL(req.url ?? '/', 'http://dsh.invalid').pathname
    if (!pathname.startsWith('/api/')) return false
    try {
      const authentication = await policy.authenticate(requestFromNode(req))
      if ('principal' in authentication) return false
    } catch {
      // Reject below without disclosing the validation failure.
    }
    socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 12\r\n\r\nunauthorized')
    return true
  }), 'dsh-dex: upgrade guard')

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
        return jsonResponse(res, 200, { authenticated: true, user: { username: principal.username, email: principal.email, name: principal.name, groups: principal.groups } })
      },
    },
    {
      path: '/auth/client.js',
      handler: (req, res) => {
        if (req.method !== 'GET') return jsonResponse(res, 405, { error: 'method not allowed' })
        const body = clientScript()
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) })
        res.end(body)
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
