import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { beginAuthorization } from './authorization'
import { ADA, browse, linear } from './harness'
import { readViewer } from './identity'
import { refreshGrant } from './tokens'

test('a consented sign-in yields a renewable grant for the Linear user it belongs to', async (context) => {
  const [fake, endpoints] = await linear(context)
  fake.signIn(ADA)
  const start = await beginAuthorization(endpoints, new AbortController().signal)
  assert.ok(start.ok)
  const url = new URL(start.authorization.url)
  assert.equal(url.origin, fake.origin)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(url.searchParams.get('scope'), 'read,write')
  assert.match(await browse(start.authorization.url), /Linear is connected to Argo/)
  const outcome = await start.authorization.outcome
  assert.ok(outcome.kind === 'granted')
  assert.deepEqual(outcome.grant.scopes, ['read', 'write'])
  assert.ok((outcome.grant.renewal?.expiresAt ?? 0) > Date.now() + 86_000_000)
  const identity = await readViewer(endpoints, outcome.grant.accessToken)
  assert.deepEqual(identity, {
    ok: true,
    value: { providerAccountId: 'user-ada', login: 'Ada Lovelace', workspace: 'Analytical' },
  })
})

test('a declined consent ends as declined', async (context) => {
  const [fake, endpoints] = await linear(context)
  fake.signIn('declined')
  const start = await beginAuthorization(endpoints, new AbortController().signal)
  assert.ok(start.ok)
  await browse(start.authorization.url)
  assert.deepEqual(await start.authorization.outcome, { kind: 'declined' })
})

test('a callback carrying another request’s state is refused without spending the code', async (context) => {
  const [fake, endpoints] = await linear(context)
  fake.signIn(ADA)
  const start = await beginAuthorization(endpoints, new AbortController().signal)
  assert.ok(start.ok)
  const forged = new URL(start.authorization.url)
  forged.searchParams.set('state', 'somebody-else')
  await browse(forged.href)
  assert.deepEqual(await start.authorization.outcome, { kind: 'refused' })
  assert.equal(fake.requests.filter((line) => line === 'POST /oauth/token').length, 0)
})

test('a sign-in nobody answers ends as expired, and a cancelled one as cancelled', async (context) => {
  const [fake, endpoints] = await linear(context)
  fake.signIn('held')
  const waited = await beginAuthorization(endpoints, new AbortController().signal, 20)
  assert.ok(waited.ok)
  assert.deepEqual(await waited.authorization.outcome, { kind: 'expired' })
  const controller = new AbortController()
  const cancelled = await beginAuthorization(endpoints, controller.signal)
  assert.ok(cancelled.ok)
  controller.abort()
  assert.deepEqual(await cancelled.authorization.outcome, { kind: 'cancelled' })
})

test('a redirect port another process holds refuses before the browser opens', async (context) => {
  const [, endpoints] = await linear(context)
  const holder = createServer()
  await new Promise<void>((resolve) => holder.listen(0, '127.0.0.1', resolve))
  context.after(() => holder.close())
  const redirectPort = (holder.address() as AddressInfo).port
  const start = await beginAuthorization(
    { ...endpoints, redirectPort },
    new AbortController().signal,
  )
  assert.deepEqual(start, { ok: false, failure: 'port-busy' })
})

test('a refresh rotates the refresh token, and the spent one is refused', async (context) => {
  const [fake, endpoints] = await linear(context)
  fake.signIn(ADA)
  const start = await beginAuthorization(endpoints, new AbortController().signal)
  assert.ok(start.ok)
  await browse(start.authorization.url)
  const outcome = await start.authorization.outcome
  assert.ok(outcome.kind === 'granted' && outcome.grant.renewal)
  const spent = outcome.grant.renewal.refreshToken
  const renewed = await refreshGrant(endpoints, spent)
  assert.ok(renewed.ok)
  assert.notEqual(renewed.grant.accessToken, outcome.grant.accessToken)
  assert.notEqual(renewed.grant.renewal?.refreshToken, spent)
  assert.deepEqual(await refreshGrant(endpoints, spent), { ok: false, failure: 'refused' })
})

test('a Linear that cannot be reached leaves a refresh unreachable, not refused', async (context) => {
  const [fake, endpoints] = await linear(context)
  fake.outage('down')
  assert.deepEqual(await refreshGrant(endpoints, 'linear-refresh-1'), {
    ok: false,
    failure: 'unreachable',
  })
  await fake.close()
  assert.deepEqual(await refreshGrant(endpoints, 'linear-refresh-1'), {
    ok: false,
    failure: 'unreachable',
  })
})
