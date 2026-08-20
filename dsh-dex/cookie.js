import { createHmac, timingSafeEqual } from 'node:crypto'

function base64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url')
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

export function signCookiePayload(payload, secret) {
  const encoded = base64Url(JSON.stringify(payload))
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function readSignedCookie(value, secret, config) {
  const [encoded, signature] = String(value ?? '').split('.')
  if (!encoded || !signature) return undefined
  const expected = createHmac('sha256', secret).update(encoded).digest()
  const supplied = decodeBase64Url(signature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return undefined
  let payload
  try { payload = JSON.parse(decodeBase64Url(encoded).toString('utf8')) } catch { return undefined }
  if (!payload || payload.v !== 1 || typeof payload.exp !== 'number') return undefined
  if (payload.exp < Math.floor(Date.now() / 1000) - config.maxClockSkewSeconds) return undefined
  const principal = principalClaims(payload)
  return principal.sub ? principal : undefined
}

export function createCookieForTest(payload, secret) {
  return signCookiePayload(payload, secret)
}

export function parseCookieForTest(value, secret, config = { maxClockSkewSeconds: 0 }) {
  return readSignedCookie(value, secret, config)
}
