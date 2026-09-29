// A mock GitHub per test, and a signed-in token on it.
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import { type MockGitHub, startMockGitHub } from '@/mocks/providers/github/mock-github'
import { octocatUser } from '@/mocks/tickets/scenario'
import { awaitGrant, requestChallenge } from '@/providers/github/device-flow'
import { type GitHubEndpoints, proofEndpoints } from '@/providers/github/endpoints'

export { octocatUser }

export async function github(context: TestContext): Promise<[MockGitHub, GitHubEndpoints]> {
  const mock = await startMockGitHub()
  context.after(() => mock.close())
  const endpoints = proofEndpoints(mock.origin)
  assert.ok(endpoints)
  return [mock, endpoints]
}

type RepositorySetup = Omit<Parameters<MockGitHub['addRepository']>[0], 'visibleTo'>

export async function githubWithRepository(context: TestContext, repository: RepositorySetup) {
  const [mock, endpoints] = await github(context)
  const user = octocatUser()
  mock.signIn(user)
  mock.addRepository({ visibleTo: [user.id], ...repository })
  return { mock, endpoints, token: await signIn(endpoints) }
}

export async function signIn(endpoints: GitHubEndpoints): Promise<string> {
  const challenge = await requestChallenge(endpoints)
  assert.ok(challenge.ok)
  const outcome = await awaitGrant(endpoints, challenge.value, new AbortController().signal)
  assert.equal(outcome.kind, 'granted')
  return outcome.kind === 'granted' ? outcome.grant.accessToken : ''
}
