import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  launch,
  ledgerFile,
  OPENING,
  settle,
} from '@/harnesses/claude/integration/claude-driver-launch.ts'

// A started Session with an intercepted schedule, so a test can fire close()'s shutdown timeout
// by hand instead of waiting on it.
async function startWithCapturedSchedule(file: string) {
  const scheduled: Array<() => void> = []
  const launched = launch(file, {
    schedule: (callback) => {
      scheduled.push(callback)
    },
  })
  launched.driver.start({ cwd: '/projects/argo', prompt: 'Inspect.', setup: OPENING })
  await settle()
  return { ...launched, scheduled }
}

// A killed node-pty process reports its exit asynchronously; quitting before that lands can abort
// the app mid-teardown (#2494), so close() must not resolve until every killed process confirms.
test('close() waits for a killed Session process to report its exit before resolving', async (context) => {
  const { driver, exit } = await startWithCapturedSchedule(await ledgerFile(context))

  let closed = false
  const closing = driver.close().then(() => {
    closed = true
  })
  await settle()
  assert.equal(closed, false)

  exit(1) // the listener close() registered, after the Session's own at index 0
  await closing
  assert.equal(closed, true)
})

test('close() gives up waiting once its shutdown timeout fires, so a stuck process cannot hang a quit', async (context) => {
  const { driver, scheduled } = await startWithCapturedSchedule(await ledgerFile(context))

  let closed = false
  const closing = driver.close().then(() => {
    closed = true
  })
  await settle()
  assert.equal(closed, false)

  scheduled.at(-1)?.() // the shutdown timeout close() scheduled, with no exit ever reported
  await closing
  assert.equal(closed, true)
})
