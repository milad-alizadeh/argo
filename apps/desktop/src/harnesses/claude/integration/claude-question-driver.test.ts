import assert from 'node:assert/strict'
import { test } from 'node:test'

import { launch, ledgerFile, OPENING, settle } from './claude-driver-launch'

const DOWN = '[B'

test('answers a pending question by writing the driven keystrokes to the process', async (context) => {
  const { driver, spawned } = launch(await ledgerFile(context), {
    pendingQuestion: async () => ({ id: 'w-call-ask' }),
  })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  spawned[0].writes.length = 0

  const decided = await driver.decideQuestion(sessionId, 'w-call-ask', [
    { kind: 'options', indices: [3] },
  ])

  assert.equal(decided, true)
  assert.deepEqual(spawned[0].writes, [DOWN, DOWN, '\r'])
})

test('refuses a decision for a question id the transcript no longer names', async (context) => {
  const { driver, spawned } = launch(await ledgerFile(context), {
    pendingQuestion: async () => ({ id: 'w-call-ask' }),
  })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  spawned[0].writes.length = 0

  const decided = await driver.decideQuestion(sessionId, 'a-stale-call-id', [
    { kind: 'options', indices: [1] },
  ])

  assert.equal(decided, false)
  assert.deepEqual(spawned[0].writes, [])
})

test('refuses a decision once the question is no longer pending', async (context) => {
  const { driver, spawned } = launch(await ledgerFile(context), {
    pendingQuestion: async () => null,
  })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()
  spawned[0].writes.length = 0

  const decided = await driver.decideQuestion(sessionId, 'w-call-ask', [
    { kind: 'options', indices: [1] },
  ])

  assert.equal(decided, false)
  assert.deepEqual(spawned[0].writes, [])
})

test('refuses a decision for a Session the driver does not hold', async (context) => {
  const { driver } = launch(await ledgerFile(context), {
    pendingQuestion: async () => ({ id: 'w-call-ask' }),
  })

  const decided = await driver.decideQuestion('gone', 'w-call-ask', [
    { kind: 'options', indices: [1] },
  ])

  assert.equal(decided, false)
})
