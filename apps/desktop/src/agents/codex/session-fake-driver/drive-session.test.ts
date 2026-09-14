import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  interruptCodexSession,
  renameCodexSession,
  sendCodexSession,
} from '../drive/drive-session.ts'

const sessionId = 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'

test('sends a subsequent Turn to the selected managed Codex Session', async () => {
  const reply = await sendCodexSession(
    {
      version: 1,
      type: 'session.codex.send',
      requestId: 'send-1',
      sessionId,
      prompt: 'Continue with the focused tests.',
    },
    {
      async interrupt() {},
      async send(receivedSessionId, prompt) {
        assert.equal(receivedSessionId, sessionId)
        assert.equal(prompt, 'Continue with the focused tests.')
      },
    },
  )

  assert.deepEqual(reply, {
    version: 1,
    type: 'session.codex.accepted',
    requestId: 'send-1',
    sessionId,
  })
})

test('interrupts only the selected managed Codex Session', async () => {
  const reply = await interruptCodexSession(
    { version: 1, type: 'session.codex.interrupt', requestId: 'stop-1', sessionId },
    {
      async interrupt(receivedSessionId) {
        assert.equal(receivedSessionId, sessionId)
      },
      async send() {},
    },
  )

  assert.equal(reply.type, 'session.codex.accepted')
  assert.equal(reply.requestId, 'stop-1')
})

test('reports a Codex Session that is no longer drivable', async () => {
  const reply = await sendCodexSession(
    { version: 1, type: 'session.codex.send', requestId: 'send-2', sessionId, prompt: 'Continue.' },
    {
      async interrupt() {},
      async send() {
        throw new Error('Codex Session is no longer running.')
      },
    },
  )

  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'codex-not-drivable')
  assert.equal(reply.requestId, 'send-2')
})

test('renames the selected managed Codex Session with its accepted native title', async () => {
  const reply = await renameCodexSession(
    {
      version: 1,
      type: 'session.rename',
      requestId: 'rename-1',
      sessionId,
      name: 'Investigate the roster',
    },
    {
      async interrupt() {},
      async rename(receivedSessionId, name) {
        assert.equal(receivedSessionId, sessionId)
        assert.equal(name, 'Investigate the roster')
        return 'Investigate the roster'
      },
      async send() {},
    },
  )

  assert.deepEqual(reply, {
    version: 1,
    type: 'session.renamed',
    requestId: 'rename-1',
    sessionId,
    title: 'Investigate the roster',
  })
})
