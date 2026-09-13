import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ClaudeTurnRequest } from '../drive/deliver-turn.ts'
import { driveClaudeSession } from '../drive/drive-session.ts'
import { ClaudeSessionDriverError } from '../drive/driver-error.ts'

const sessionId = 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'
const sendRequest = {
  version: 1,
  type: 'session.claude.send',
  requestId: 'send-1',
  sessionId,
  prompt: 'Continue with the focused tests.',
  setup: { model: 'haiku', effort: 'low', mode: 'plan' },
} as const

test('sends a subsequent Turn at its chosen setup to the selected managed Claude Session', async () => {
  const sent: [string, ClaudeTurnRequest][] = []
  const reply = await driveClaudeSession(sendRequest, {
    interrupt: () => {},
    send: async (receivedSessionId, turn) => {
      sent.push([receivedSessionId, turn])
    },
  })

  assert.deepEqual(sent, [
    [
      sessionId,
      {
        prompt: 'Continue with the focused tests.',
        setup: { model: 'haiku', effort: 'low', mode: 'plan' },
      },
    ],
  ])
  assert.deepEqual(reply, {
    version: 1,
    type: 'session.claude.accepted',
    requestId: 'send-1',
    sessionId,
  })
})

test('does not accept a Turn Claude could not be given', async () => {
  const reply = await driveClaudeSession(sendRequest, {
    interrupt: () => {},
    send: async () => {
      throw new Error('Claude Session is no longer running.')
    },
  })

  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'not-drivable')
})

test('refuses a Turn whose setup names a Mode Claude does not offer', async () => {
  const reply = await driveClaudeSession(
    { ...sendRequest, setup: { ...sendRequest.setup, mode: 'yolo' } },
    { interrupt: () => {}, send: async () => {} },
  )

  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'invalid-request')
})

test('interrupts only the selected managed Claude Session', async () => {
  const interrupted: string[] = []
  const reply = await driveClaudeSession(
    { version: 1, type: 'session.claude.interrupt', requestId: 'stop-1', sessionId },
    { interrupt: (receivedSessionId) => interrupted.push(receivedSessionId), send: async () => {} },
  )

  assert.deepEqual(interrupted, [sessionId])
  assert.equal(reply.type, 'session.claude.accepted')
  assert.equal(reply.requestId, 'stop-1')
})

for (const code of [
  'not-resumable',
  'held-elsewhere',
  'missing-session',
  'launch-failed',
] as const) {
  test(`answers a Turn the driver refuses as ${code} with that reason`, async () => {
    const reply = await driveClaudeSession(sendRequest, {
      interrupt: () => {},
      send: async () => {
        throw new ClaudeSessionDriverError(code)
      },
    })

    assert.equal(reply.type, 'session.error')
    assert.equal(reply.type === 'session.error' && reply.code, code)
    assert.equal(reply.requestId, 'send-1')
  })
}
