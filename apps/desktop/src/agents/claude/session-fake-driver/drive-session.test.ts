import assert from 'node:assert/strict'
import { test } from 'node:test'

import { driveClaudeSession } from '../drive/drive-session.ts'

const sessionId = 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'

test('sends a subsequent Turn to the selected managed Claude Session', () => {
  const reply = driveClaudeSession(
    {
      version: 1,
      type: 'session.claude.send',
      requestId: 'send-1',
      sessionId,
      prompt: 'Continue with the focused tests.',
    },
    {
      interrupt: () => {},
      send(receivedSessionId, prompt) {
        assert.equal(receivedSessionId, sessionId)
        assert.equal(prompt, 'Continue with the focused tests.')
      },
    },
  )

  assert.deepEqual(reply, {
    version: 1,
    type: 'session.claude.accepted',
    requestId: 'send-1',
    sessionId,
  })
})

test('interrupts only the selected managed Claude Session', () => {
  const reply = driveClaudeSession(
    { version: 1, type: 'session.claude.interrupt', requestId: 'stop-1', sessionId },
    {
      interrupt(receivedSessionId) {
        assert.equal(receivedSessionId, sessionId)
      },
      send: () => {},
    },
  )

  assert.equal(reply.type, 'session.claude.accepted')
  assert.equal(reply.requestId, 'stop-1')
})
