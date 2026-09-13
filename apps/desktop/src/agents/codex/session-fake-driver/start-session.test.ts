import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CodexSessionDriverError } from '../drive/codex-session-driver.ts'
import { startCodexSession } from '../drive/start-session.ts'

const request = {
  version: 1,
  type: 'session.codex.start',
  requestId: 'start-1',
  cwd: '/projects/argo',
  prompt: 'Inspect the failing test.',
} as const

test('starts the Codex Session named by the IPC request', async () => {
  const reply = await startCodexSession(request, {
    async start(received) {
      assert.deepEqual(received, { cwd: '/projects/argo', prompt: 'Inspect the failing test.' })
      return 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'
    },
  })

  assert.deepEqual(reply, {
    version: 1,
    type: 'session.codex.started',
    requestId: 'start-1',
    sessionId: 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
  })
})

test('reports a Codex launch failure without accepting the draft', async () => {
  const reply = await startCodexSession(request, {
    async start() {
      throw new CodexSessionDriverError('codex-cli-unavailable')
    },
  })

  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'codex-cli-unavailable')
  assert.equal(reply.requestId, 'start-1')
})
