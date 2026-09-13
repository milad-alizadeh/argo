import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createClaudeSessionDriver } from '../drive/claude-session-driver.ts'

test('starts a named interactive Claude Session and sends the opening Turn', () => {
  const writes: string[] = []
  const calls: {
    command: string
    commandArguments: string[]
    cwd: string
    environment: NodeJS.ProcessEnv
  }[] = []
  const driver = createClaudeSessionDriver({
    findExecutable: () => '/usr/local/bin/claude',
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    schedule: (callback) => callback(),
    spawn: (command, commandArguments, options) => {
      calls.push({ command, commandArguments, cwd: options.cwd, environment: options.env })
      return { write: (text) => writes.push(text) }
    },
  })

  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  assert.equal(sessionId, 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c')
  assert.deepEqual(calls, [
    {
      command: '/usr/local/bin/claude',
      commandArguments: ['--session-id', sessionId, '--permission-mode', 'manual'],
      cwd: '/projects/argo',
      environment: { ...process.env, TERM: 'xterm-256color' },
    },
  ])
  assert.deepEqual(writes, ['\u001b[200~Inspect the failing test.\u001b[201~', '\r'])
  assert.deepEqual(
    driver.roster().map(({ id, posture, status }) => ({ id, posture, status })),
    [{ id: sessionId, posture: 'managed', status: 'running' }],
  )
})

test('does not let the parent Claude Session suppress transcript persistence', () => {
  const driver = createClaudeSessionDriver({
    findExecutable: () => '/usr/local/bin/claude',
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    schedule: (callback) => callback(),
    spawn: (_command, _arguments, options) => {
      assert.equal(options.env.CLAUDE_CODE_CHILD_SESSION, undefined)
      return { write: () => {} }
    },
  })

  const previous = process.env.CLAUDE_CODE_CHILD_SESSION
  process.env.CLAUDE_CODE_CHILD_SESSION = 'parent-session'
  try {
    driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CODE_CHILD_SESSION
    else process.env.CLAUDE_CODE_CHILD_SESSION = previous
  }
})
