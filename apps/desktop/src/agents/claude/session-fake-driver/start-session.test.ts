import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ClaudeSessionDriverError } from '../drive/claude-session-driver.ts'
import { startClaudeSession } from '../drive/start-session.ts'

const request = {
  version: 1,
  type: 'session.claude.start',
  requestId: 'start-1',
  cwd: '/projects/argo',
  prompt: 'Inspect the failing test.',
} as const

test('starts the Claude Session named by the IPC request', () => {
  const reply = startClaudeSession(request, {
    start(received) {
      assert.deepEqual(received, { cwd: '/projects/argo', prompt: 'Inspect the failing test.' })
      return 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'
    },
  })

  assert.deepEqual(reply, {
    version: 1,
    type: 'session.claude.started',
    requestId: 'start-1',
    sessionId: 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
  })
})

test('reports a Claude launch failure without accepting the draft', () => {
  const reply = startClaudeSession(request, {
    start() {
      throw new ClaudeSessionDriverError('cli-unavailable')
    },
  })

  assert.equal(reply.type, 'session.error')
  assert.equal(reply.code, 'cli-unavailable')
  assert.equal(reply.requestId, 'start-1')
})
