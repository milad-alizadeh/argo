import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ClaudeSessionDriverError } from '../drive/drive-channel.ts'
import { driveClaudeSession } from '../drive/drive-session.ts'

const sessionId = 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'
const sendRequest = {
  version: 1,
  type: 'session.claude.send',
  requestId: 'send-1',
  sessionId,
  prompt: 'Continue with the focused tests.',
}

test('sends a subsequent Turn to the selected managed Claude Session', async () => {
  const sent: Array<[string, string]> = []
  const reply = await driveClaudeSession(sendRequest, {
    interrupt: () => {},
    send: async (receivedSessionId, prompt) => {
      sent.push([receivedSessionId, prompt])
    },
  })

  assert.deepEqual(sent, [[sessionId, 'Continue with the focused tests.']])
  assert.deepEqual(reply, {
    version: 1,
    type: 'session.claude.accepted',
    requestId: 'send-1',
    sessionId,
  })
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
