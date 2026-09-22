import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import {
  createHarnessSignIn,
  type HarnessSignInDriver,
  type HarnessSignInOutcome,
} from '@/domains/harness-signin/main/harness-sign-in'

const readyReadiness: HarnessReadiness = { harness: 'claude', state: 'ready', detail: null }

function deferredDriver() {
  let resolve: (outcome: HarnessSignInOutcome) => void = () => undefined
  let aborted = false
  const outcome = new Promise<HarnessSignInOutcome>((settle) => {
    resolve = settle
  })
  const driver: HarnessSignInDriver = {
    login: (signal) => {
      signal.addEventListener('abort', () => {
        aborted = true
      })
      return outcome
    },
    checkReadiness: async () => readyReadiness,
  }
  return { driver, resolve, isAborted: () => aborted }
}

function drivers(claude: HarnessSignInDriver) {
  const codex: HarnessSignInDriver = {
    login: async () => 'failed',
    checkReadiness: async () => ({ harness: 'codex', state: 'signed-out', detail: null }),
  }
  return { claude, codex }
}

test('Harness sign-in: wait before any start reports no attempt', async () => {
  const { driver } = deferredDriver()
  const signIn = createHarnessSignIn(drivers(driver))
  assert.equal(await signIn.wait('claude'), null)
})

test('Harness sign-in: a second start while the first is live resumes the same attempt', () => {
  const { driver } = deferredDriver()
  const signIn = createHarnessSignIn(drivers(driver))
  const first = signIn.start('claude')
  const second = signIn.start('claude')
  assert.deepEqual(second, first)
})

test('Harness sign-in: a completed login reads back readiness and reports ready', async () => {
  const { driver, resolve } = deferredDriver()
  const signIn = createHarnessSignIn(drivers(driver))
  signIn.start('claude')
  resolve('completed')
  const result = await signIn.wait('claude')
  assert.deepEqual(result, {
    snapshot: { harness: 'claude', status: 'ready', expiresAt: null },
    readiness: readyReadiness,
  })
})

test('Harness sign-in: cancel aborts the in-flight login and reports canceled', async () => {
  const { driver, resolve, isAborted } = deferredDriver()
  const signIn = createHarnessSignIn(drivers(driver))
  signIn.start('claude')
  const canceled = await signIn.cancel('claude')
  assert.equal(canceled.status, 'canceled')
  assert.equal(isAborted(), true)
  resolve('canceled')
  assert.equal(await signIn.wait('claude'), null)
})

test('Harness sign-in: a driver that rejects reads failed rather than throwing', async () => {
  const failing: HarnessSignInDriver = {
    login: async () => {
      throw new Error('spawn failed')
    },
    checkReadiness: async () => readyReadiness,
  }
  const signIn = createHarnessSignIn(drivers(failing))
  signIn.start('claude')
  const result = await signIn.wait('claude')
  assert.deepEqual(result, {
    snapshot: { harness: 'claude', status: 'failed', expiresAt: null },
    readiness: null,
  })
})

test('Harness sign-in: an attempt past its expiry reports expired and starting again begins fresh', async () => {
  const { driver } = deferredDriver()
  let now = 0
  const signIn = createHarnessSignIn(drivers(driver), { expiresAfterMs: 1000, now: () => now })
  const started = signIn.start('claude')
  assert.equal(started.expiresAt, 1000)
  now = 2000
  const result = await signIn.wait('claude')
  assert.deepEqual(result, {
    snapshot: { harness: 'claude', status: 'expired', expiresAt: null },
    readiness: null,
  })
  const restarted = signIn.start('claude')
  assert.equal(restarted.expiresAt, 3000)
})
