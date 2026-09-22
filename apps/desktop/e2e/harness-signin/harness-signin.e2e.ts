// Proves the open Harness readiness/sign-in acceptance criterion (#2579): a packaged launch reads
// missing, signed-out, ready, policy-blocked, canceled and expired, and the gate screen says so in
// reader-visible text.
import { expect, test } from './fixtures/harness-signin.fixture'

test.describe('missing', () => {
  test.use({ harnessSignInScenario: 'missing' })

  test('shows the CLI install prompt for a Harness with no executable', async ({
    harnessSignIn,
  }) => {
    const { page } = harnessSignIn
    await expect(page.getByText('Sign in to a Harness')).toBeVisible()
    await expect(page.getByText('Install the Claude CLI, then sign in.')).toBeVisible()
    await expect(page.getByText('Not installed')).toHaveCount(2)
  })
})

test.describe('signed-out', () => {
  test.use({ harnessSignInScenario: 'signed-out' })

  test('offers sign-in for a Harness that answered signed out', async ({ harnessSignIn }) => {
    const { page } = harnessSignIn
    await expect(page.getByText('Sign in to a Harness')).toBeVisible()
    await expect(page.getByText('Not signed in')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})

test.describe('ready', () => {
  test.use({ harnessSignInScenario: 'ready' })

  test('replaces the gate screen with the cockpit once a Harness reads ready', async ({
    harnessSignIn,
  }) => {
    const { page } = harnessSignIn
    await expect(page.getByRole('button', { name: /Current project: example/i })).toBeVisible()
    await expect(page.getByText('Sign in to a Harness')).toHaveCount(0)
  })
})

test.describe('policy-blocked', () => {
  test.use({ harnessSignInScenario: 'policy-blocked' })

  test('reads a non-firstParty apiProvider as blocked by policy, with no sign-in offered', async ({
    harnessSignIn,
  }) => {
    const { page } = harnessSignIn
    await expect(page.getByText('Sign in to a Harness')).toBeVisible()
    await expect(page.getByText('Blocked by policy')).toBeVisible()
    await expect(page.getByText('bedrock')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0)
  })
})

test.describe('canceled', () => {
  test.use({ harnessSignInScenario: 'canceled' })

  test('reports a cancelled sign-in attempt and offers to try again', async ({ harnessSignIn }) => {
    const { page } = harnessSignIn
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Waiting for Claude' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Sign-in canceled.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})

test.describe('expired', () => {
  test.use({ harnessSignInScenario: 'expired' })

  test('reports an expired sign-in attempt and offers to try again', async ({ harnessSignIn }) => {
    const { page } = harnessSignIn
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByText('The sign-in expired. Try again.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })
})
