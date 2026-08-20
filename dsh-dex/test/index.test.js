import test from 'node:test'
import assert from 'node:assert/strict'
import { createCookieForTest, parseCookieForTest } from '../cookie.js'

test('signed session cookies round-trip and reject tampering', () => {
  const secret = 'x'.repeat(32)
  const now = Math.floor(Date.now() / 1000)
  const cookie = createCookieForTest({ v: 1, sub: 'user-1', username: 'alice', exp: now + 60, groups: [] }, secret)
  assert.equal(parseCookieForTest(cookie, secret, { maxClockSkewSeconds: 0 }).sub, 'user-1')
  const tampered = `${cookie.slice(0, -1)}${cookie.endsWith('a') ? 'b' : 'a'}`
  assert.equal(parseCookieForTest(tampered, secret, { maxClockSkewSeconds: 0 }), undefined)
})

test('expired session cookies are rejected', () => {
  const cookie = createCookieForTest({ v: 1, sub: 'user-1', username: 'alice', exp: 1, groups: [] }, 'x'.repeat(32))
  assert.equal(parseCookieForTest(cookie, 'x'.repeat(32), { maxClockSkewSeconds: 0 }), undefined)
})
