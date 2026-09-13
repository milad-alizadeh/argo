import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CYCLE_MODE, REDRAW } from '../drive/claude-setup.ts'
import { FOOTERS, OPENING, startedSession } from './claude-driver-launch.ts'

test('cycles the Mode until the Claude footer shows the chosen Mode, then sends the Turn', async (context) => {
  const { driver, sessionId, writes } = await startedSession(context)

  await driver.send(sessionId, { prompt: 'Next.', setup: { ...OPENING, mode: 'plan' } })

  assert.deepEqual(writes, [
    CYCLE_MODE,
    REDRAW,
    CYCLE_MODE,
    REDRAW,
    '\u001b[200~Next.\u001b[201~',
    '\r',
  ])
})

test('stops cycling at the starting Mode when the chosen Mode is not offered, and still sends the Turn', async (context) => {
  const { driver, sessionId, writes } = await startedSession(context)

  await driver.send(sessionId, {
    prompt: 'Next.',
    setup: { ...OPENING, mode: 'bypassPermissions' },
  })

  assert.deepEqual(writes, [
    ...Array.from({ length: FOOTERS.length }, () => [CYCLE_MODE, REDRAW]).flat(),
    '\u001b[200~Next.\u001b[201~',
    '\r',
  ])
})

test('does not cycle again after reaching the chosen Mode', async (context) => {
  const { driver, sessionId, writes } = await startedSession(context)
  await driver.send(sessionId, { prompt: 'Plan it.', setup: { ...OPENING, mode: 'auto' } })
  writes.length = 0

  await driver.send(sessionId, { prompt: 'Again.', setup: { ...OPENING, mode: 'auto' } })

  assert.deepEqual(writes, ['\u001b[200~Again.\u001b[201~', '\r'])
})
