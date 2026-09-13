import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createClaudeSessionDriver } from '../drive/claude-session-driver.ts'
import { createOwnershipLedger } from '../drive/ownership-ledger.ts'
import { launch, ledgerFile, PASTED } from './claude-driver-launch.ts'

test('starts a named interactive Claude Session and sends the opening Turn', async (context) => {
  const { driver, spawned } = launch(await ledgerFile(context))

  const sessionId = driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  assert.equal(sessionId, 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c')
  assert.deepEqual(spawned, [
    {
      command: '/usr/local/bin/claude',
      commandArguments: ['--session-id', sessionId, '--permission-mode', 'manual'],
      cwd: '/projects/argo',
      writes: PASTED('Inspect the failing test.'),
    },
  ])
  assert.deepEqual(
    driver.roster().map(({ id, posture, status }) => ({ id, posture, status })),
    [{ id: sessionId, posture: 'managed', status: 'running' }],
  )
})

test('does not let the parent Claude Session suppress transcript persistence', async (context) => {
  const ledger = createOwnershipLedger({
    path: await ledgerFile(context),
    owner: { pid: process.pid, registry: 'window-a' },
    isAlive: () => true,
  })
  const driver = createClaudeSessionDriver({
    findExecutable: () => '/usr/local/bin/claude',
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    schedule: (callback) => callback(),
    ledger,
    resumeTarget: async () => null,
    spawn: (_command, _arguments, options) => {
      assert.equal(options.env.CLAUDE_CODE_CHILD_SESSION, undefined)
      assert.equal(options.env.TERM, 'xterm-256color')
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

test('a Session Argo starts is still read as Argo’s after the app restarts', async (context) => {
  const file = await ledgerFile(context)
  const first = launch(file)
  const sessionId = first.driver.start({ cwd: '/projects/argo', prompt: 'Inspect.' })
  first.driver.close()

  const second = launch(file, { registry: 'window-b' })

  assert.deepEqual([...second.driver.orphans()], [sessionId])
})
