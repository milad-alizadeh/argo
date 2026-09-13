import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fakeClaude, OPENING, settle, startedSession } from './fake-claude.ts'

test('starts a named interactive Claude Session at the chosen setup and sends the opening Turn', async () => {
  const { calls, driver, writes } = fakeClaude()

  const sessionId = driver.start({
    cwd: '/projects/argo',
    prompt: 'Inspect the failing test.',
    setup: { model: 'sonnet', effort: 'max', mode: 'plan' },
  })
  await settle()

  assert.equal(sessionId, 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c')
  assert.deepEqual(
    calls.map(({ command, commandArguments, environment }) => ({
      command,
      commandArguments,
      terminal: environment.TERM,
    })),
    [
      {
        command: '/usr/local/bin/claude',
        commandArguments: [
          '--session-id',
          sessionId,
          '--model',
          'sonnet',
          '--effort',
          'max',
          '--permission-mode',
          'plan',
        ],
        terminal: 'xterm-256color',
      },
    ],
  )
  assert.deepEqual(writes, ['\u001b[200~Inspect the failing test.\u001b[201~', '\r'])
  assert.deepEqual(
    driver.roster().map(({ id, posture, status, setup }) => ({ id, posture, status, setup })),
    [
      {
        id: sessionId,
        posture: 'managed',
        status: 'running',
        setup: { model: 'sonnet', effort: 'max', mode: 'plan' },
      },
    ],
  )
})

test('types a setup command only for what the next Turn changes, then the prompt', async () => {
  const paste = ['\u001b[200~Next.\u001b[201~', '\r']
  const cases = [
    { setup: OPENING, typed: paste },
    { setup: { ...OPENING, effort: 'low' }, typed: ['/effort low', '\r', ...paste] },
    {
      setup: { ...OPENING, model: 'haiku', effort: 'medium' },
      typed: ['/model haiku', '\r', '/effort medium', '\r', ...paste],
    },
  ] as const
  for (const { setup, typed } of cases) {
    const { driver, sessionId, writes } = await startedSession()
    await driver.send(sessionId, { prompt: 'Next.', setup })
    assert.deepEqual(writes, typed)
  }
})

test('does not let the parent Claude Session suppress transcript persistence', () => {
  const { calls, driver } = fakeClaude()

  const previous = process.env.CLAUDE_CODE_CHILD_SESSION
  process.env.CLAUDE_CODE_CHILD_SESSION = 'parent-session'
  try {
    driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.', setup: OPENING })
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CODE_CHILD_SESSION
    else process.env.CLAUDE_CODE_CHILD_SESSION = previous
  }

  assert.equal(calls[0]?.environment.CLAUDE_CODE_CHILD_SESSION, undefined)
})
