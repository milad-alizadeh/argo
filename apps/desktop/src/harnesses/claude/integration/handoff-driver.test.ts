import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  launch,
  ledgerFile,
  OPENING,
  PASTED,
  STARTED_AT,
  settle,
  startedSession,
} from './claude-driver-launch'

test('typing /handoff starts the wait and names the exact brief path', async (context) => {
  const { driver, sessionId, writes } = await startedSession(context)

  await driver.handoff(sessionId)

  assert.equal(writes.length, 2)
  assert.match(writes[0] ?? '', /^\/handoff /)
  assert.match(writes[0] ?? '', /handoff-.*\.md$/)
  assert.equal(writes[1], '\r')
  assert.notEqual(driver.roster()[0]?.handoffStartedAt, null)
})

test('a brief that arrives spawns the fresh Session and records the edge in the handoff ledger', async (context) => {
  const briefs = new Map<string, string>()
  const ids = ['claude-source', 'claude-fresh']
  const { driver, handoffLedger, spawned } = launch(await ledgerFile(context), {
    readHandoffBrief: (briefPath) => briefs.get(briefPath) ?? null,
    mintSessionId: () => ids.shift() ?? 'unexpected',
  })
  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Start.', setup: OPENING })
  await settle()

  await driver.handoff(sessionId)
  const command = spawned[0]?.writes.at(-2) ?? ''
  const briefPath = command.slice(command.indexOf('The path is: ') + 'The path is: '.length)
  briefs.set(briefPath, 'Continue the migration.')

  driver.completeHandoffs()
  await settle()

  assert.deepEqual(handoffLedger.edgesFor(sessionId), { to: 'claude-fresh', from: null })
  assert.equal(driver.roster().find((row) => row.id === sessionId)?.handoffStartedAt, null)
  assert.ok(driver.roster().some((row) => row.id === 'claude-fresh'))
  assert.equal(spawned[1]?.commandArguments.includes('--session-id'), true)
})

test('a handoff past its patience gives up and leaves the source Session usable', async (context) => {
  let clock = STARTED_AT
  const { driver, sessionId, writes } = await startedSession(context, {
    now: () => clock,
    handoffPatienceMs: 1000,
  })

  await driver.handoff(sessionId)
  writes.length = 0
  clock = new Date(STARTED_AT.getTime() + 1000)
  driver.completeHandoffs()

  const row = driver.roster().find((entry) => entry.id === sessionId)
  assert.equal(row?.handoffStartedAt, null)
  assert.equal(row?.handoffFailure, 'Argo did not receive a handoff brief in time.')
  await driver.send(sessionId, { prompt: 'Still here.', setup: OPENING })
  assert.deepEqual(writes, PASTED('Still here.'))
})
