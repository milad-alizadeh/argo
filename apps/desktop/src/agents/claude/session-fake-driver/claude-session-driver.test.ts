import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  launch,
  ledgerFile,
  OPENING,
  PASTED,
  settle,
  startedSession,
} from './claude-driver-launch.ts'

test('starts a named interactive Claude Session at the chosen setup and sends the opening Turn', async (context) => {
  const { driver, spawned } = launch(await ledgerFile(context))

  const sessionId = driver.start({
    cwd: '/projects/argo',
    prompt: 'Inspect the failing test.',
    setup: { model: 'sonnet', effort: 'max', mode: 'plan' },
  })
  await settle()

  assert.equal(sessionId, 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c')
  assert.deepEqual(
    spawned.map(({ command, commandArguments, cwd, environment, writes }) => ({
      command,
      commandArguments,
      cwd,
      terminal: environment.TERM,
      writes,
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
        cwd: '/projects/argo',
        terminal: 'xterm-256color',
        writes: PASTED('Inspect the failing test.'),
      },
    ],
  )
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

test('holds the text a Turn streams until Argo sends the next Turn or interrupts', async (context) => {
  const { driver, display, sessionId } = await startedSession(context)
  const batch = (turn: string, delta: string) =>
    display(sessionId, { turn_id: turn, message_id: `${turn}-message`, index: 0, delta })

  batch('turn-1', 'Ducks glide.')
  const streamed = driver.liveMessages(sessionId)
  await driver.send(sessionId, { prompt: 'Now geese.', setup: OPENING })
  const afterSend = driver.liveMessages(sessionId)
  batch('turn-1', 'Late ducks.')
  batch('turn-2', 'Geese honk.')
  const next = driver.liveMessages(sessionId)
  driver.interrupt(sessionId)

  assert.deepEqual(streamed, [{ id: 'turn-1-message', text: 'Ducks glide.' }])
  assert.deepEqual(afterSend, [])
  assert.deepEqual(next, [{ id: 'turn-2-message', text: 'Geese honk.' }])
  assert.deepEqual(driver.liveMessages(sessionId), [])
})

test('types a setup command only for what the next Turn changes, then the prompt', async (context) => {
  const cases = [
    { setup: OPENING, typed: PASTED('Next.') },
    { setup: { ...OPENING, effort: 'low' }, typed: ['/effort low', '\r', ...PASTED('Next.')] },
    {
      setup: { ...OPENING, model: 'haiku', effort: 'medium' },
      typed: ['/model haiku', '\r', '/effort medium', '\r', ...PASTED('Next.')],
    },
  ] as const
  for (const { setup, typed } of cases) {
    const { driver, sessionId, writes } = await startedSession(context)
    await driver.send(sessionId, { prompt: 'Next.', setup })
    assert.deepEqual(writes, typed)
  }
})

test('does not let the parent Claude Session suppress transcript persistence', async (context) => {
  const { driver, spawned } = launch(await ledgerFile(context))

  const previous = process.env.CLAUDE_CODE_CHILD_SESSION
  process.env.CLAUDE_CODE_CHILD_SESSION = 'parent-session'
  try {
    driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.', setup: OPENING })
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CODE_CHILD_SESSION
    else process.env.CLAUDE_CODE_CHILD_SESSION = previous
  }

  assert.equal(spawned[0]?.environment.CLAUDE_CODE_CHILD_SESSION, undefined)
})

test('a Session Argo starts is still read as Argo’s after the app restarts', async (context) => {
  const file = await ledgerFile(context)
  const first = launch(file)
  const sessionId = first.driver.start({
    cwd: '/projects/argo',
    prompt: 'Inspect.',
    setup: OPENING,
  })
  first.driver.close()

  const second = launch(file, { registry: 'window-b' })

  assert.deepEqual([...second.driver.orphans()], [sessionId])
})
