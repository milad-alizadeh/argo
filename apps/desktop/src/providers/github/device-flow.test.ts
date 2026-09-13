import assert from 'node:assert/strict'
import { test } from 'node:test'
import { awaitGrant, readIdentity, requestChallenge } from './device-flow'
import { proofEndpoints } from './endpoints'
import { github, OCTOCAT } from './harness'

test('a proof origin is taken only when it is a loopback origin', () => {
  assert.deepEqual(proofEndpoints('http://127.0.0.1:4000'), {
    web: 'http://127.0.0.1:4000',
    api: 'http://127.0.0.1:4000',
  })
  for (const origin of [
    undefined,
    '',
    'https://api.github.com',
    'http://localhost:4000',
    'http://127.0.0.1:4000/',
    'http://127.0.0.1.example.com',
  ]) {
    assert.equal(proofEndpoints(origin), null, String(origin))
  }
})

test('a granted device code yields the scopes GitHub granted and a stable numeric identity', async (context) => {
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT, 2)
  const challenge = await requestChallenge(endpoints)
  assert.ok(challenge.ok)
  assert.equal(challenge.value.verificationUri, `${fake.origin}/login/device`)
  const outcome = await awaitGrant(endpoints, challenge.value, new AbortController().signal)
  assert.ok(outcome.kind === 'granted')
  assert.deepEqual(outcome.grant.scopes, ['repo', 'read:project'])
  const identity = await readIdentity(endpoints, outcome.grant.accessToken)
  assert.deepEqual(identity, { ok: true, value: { providerAccountId: '583231', login: 'octocat' } })
})

test('a sign-in the person declines or lets expire ends as that outcome', async (context) => {
  const [fake, endpoints] = await github(context)
  for (const answer of ['declined', 'expired'] as const) {
    fake.signIn(answer)
    const challenge = await requestChallenge(endpoints)
    assert.ok(challenge.ok)
    const outcome = await awaitGrant(endpoints, challenge.value, new AbortController().signal)
    assert.equal(outcome.kind, answer)
  }
})

test('a cancelled wait ends as cancelled without another poll', async (context) => {
  const [fake, endpoints] = await github(context)
  fake.signIn(OCTOCAT, 1_000)
  const challenge = await requestChallenge(endpoints)
  assert.ok(challenge.ok)
  const controller = new AbortController()
  const waiting = awaitGrant(endpoints, { ...challenge.value, interval: 60 }, controller.signal)
  controller.abort()
  assert.deepEqual(await waiting, { kind: 'cancelled' })
  assert.equal(fake.requests.filter((line) => line.includes('access_token')).length, 0)
})

test('a GitHub that cannot be reached is unreachable, not a refusal', async (context) => {
  const [fake, endpoints] = await github(context)
  await fake.close()
  assert.deepEqual(await requestChallenge(endpoints), { ok: false, failure: 'unreachable' })
})
