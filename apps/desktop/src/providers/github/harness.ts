// A fake GitHub per test, and a signed-in token on it.
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { awaitGrant, requestChallenge } from './device-flow'
import { type GitHubEndpoints, proofEndpoints } from './endpoints'
import { type FakeGitHub, startFakeGitHub } from './fake-driver/fake-github'

export const OCTOCAT = { id: 583231, login: 'octocat' }

export async function github(context: TestContext): Promise<[FakeGitHub, GitHubEndpoints]> {
  const fake = await startFakeGitHub()
  context.after(() => fake.close())
  const endpoints = proofEndpoints(fake.origin)
  assert.ok(endpoints)
  return [fake, endpoints]
}

export async function signIn(endpoints: GitHubEndpoints): Promise<string> {
  const challenge = await requestChallenge(endpoints)
  assert.ok(challenge.ok)
  const outcome = await awaitGrant(endpoints, challenge.value, new AbortController().signal)
  assert.equal(outcome.kind, 'granted')
  return outcome.kind === 'granted' ? outcome.grant.accessToken : ''
}
