// A fake Linear per test, a browser that follows its consent page, and a signed-in grant on it.
import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import type { Grant } from '../grant'
import { beginAuthorization } from './authorization'
import { type LinearEndpoints, linearProofEndpoints } from './endpoints'
import { type FakeLinear, startFakeLinear } from './fake-driver/fake-linear'

export { ADA, HIDDEN, TEAM } from './fake-driver/fake-linear-cast'

export async function linear(context: TestContext): Promise<[FakeLinear, LinearEndpoints]> {
  const fake = await startFakeLinear()
  context.after(() => fake.close())
  const endpoints = linearProofEndpoints(fake.origin)
  assert.ok(endpoints)
  return [fake, endpoints]
}

// The person's browser: opens the page and follows Linear's redirect back to the loopback.
export async function browse(url: string): Promise<string> {
  const response = await fetch(url)
  return response.text()
}

export async function signIn(endpoints: LinearEndpoints): Promise<Grant> {
  const start = await beginAuthorization(endpoints, new AbortController().signal)
  assert.ok(start.ok)
  await browse(start.authorization.url)
  const outcome = await start.authorization.outcome
  assert.ok(outcome.kind === 'granted')
  return outcome.grant
}
