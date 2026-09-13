import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createClaudeSessionDriver } from '../drive/claude-session-driver.ts'
import { FIRST_FRAME_TIMEOUT_MS, SUBMIT_DELAY_MS } from '../drive/turn-queue.ts'

const FIRST_FRAME = '\u001b[?2026h\u001b[?25l> \u001b[?25h\u001b[?2026l'
const STARTED_AT = new Date('2026-09-13T15:17:11.000Z')

function fakeClaude() {
  const writes: string[] = []
  const timers: { callback: () => void; delay: number }[] = []
  let emit: (data: string) => void = () => {}
  let exit: () => unknown = () => {}
  const driver = createClaudeSessionDriver({
    findExecutable: () => '/usr/local/bin/claude',
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    now: () => STARTED_AT,
    schedule: (callback, delay) => {
      timers.push({ callback, delay })
    },
    spawn: () => ({
      write: (text) => writes.push(text),
      onData: (listener) => {
        emit = listener
      },
      onExit: (listener) => {
        exit = listener
      },
    }),
  })
  const runTimers = (delay: number) => {
    const due = timers.filter((timer) => timer.delay === delay)
    timers.splice(0, timers.length, ...timers.filter((timer) => timer.delay !== delay))
    for (const timer of due) timer.callback()
  }
  return { driver, writes, emit: (data: string) => emit(data), exit: () => exit(), runTimers }
}

test('starts a named interactive Claude Session and sends the opening Turn', () => {
  const calls: {
    command: string
    commandArguments: string[]
    cwd: string
    environment: NodeJS.ProcessEnv
  }[] = []
  const writes: string[] = []
  const driver = createClaudeSessionDriver({
    findExecutable: () => '/usr/local/bin/claude',
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    now: () => STARTED_AT,
    schedule: (callback) => callback(),
    spawn: (command, commandArguments, options) => {
      calls.push({ command, commandArguments, cwd: options.cwd, environment: options.env })
      return { write: (text) => writes.push(text), onData: (listener) => listener(FIRST_FRAME) }
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

test('holds the opening Turn until Claude draws its first frame', () => {
  const claude = fakeClaude()
  claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  claude.emit('\u001b[?2004h\u001b[?1004h')
  assert.deepEqual(claude.writes, [])

  claude.emit(FIRST_FRAME)
  claude.runTimers(SUBMIT_DELAY_MS)
  assert.deepEqual(claude.writes, ['\u001b[200~Inspect the failing test.\u001b[201~', '\r'])
})

test('recognises a first frame split across two output chunks', () => {
  const claude = fakeClaude()
  claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  claude.emit('\u001b[?2026h> \u001b[?20')
  claude.emit('26l')
  claude.runTimers(SUBMIT_DELAY_MS)

  assert.deepEqual(claude.writes, ['\u001b[200~Inspect the failing test.\u001b[201~', '\r'])
})

test('sends a follow-up held before the first frame after the opening Turn', () => {
  const claude = fakeClaude()
  const sessionId = claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the test.' })
  claude.driver.send(sessionId, 'Then fix it.')

  claude.emit(FIRST_FRAME)
  claude.runTimers(SUBMIT_DELAY_MS)
  claude.runTimers(SUBMIT_DELAY_MS)

  assert.deepEqual(claude.writes, [
    '\u001b[200~Inspect the test.\u001b[201~',
    '\r',
    '\u001b[200~Then fix it.\u001b[201~',
    '\r',
  ])
})

test('sends the opening Turn when Claude draws no frame within the time limit', () => {
  const claude = fakeClaude()
  claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  claude.runTimers(FIRST_FRAME_TIMEOUT_MS)
  claude.runTimers(SUBMIT_DELAY_MS)
  claude.emit(FIRST_FRAME)
  claude.runTimers(SUBMIT_DELAY_MS)

  assert.deepEqual(claude.writes, ['\u001b[200~Inspect the failing test.\u001b[201~', '\r'])
})

for (const [ending, end] of [
  ['exits', (claude: ReturnType<typeof fakeClaude>) => claude.exit()],
  ['is closed', (claude: ReturnType<typeof fakeClaude>) => claude.driver.close()],
] as const) {
  test(`writes nothing to a Claude Session that ${ending} before its opening Turn is sent`, () => {
    const claude = fakeClaude()
    claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

    end(claude)
    claude.runTimers(FIRST_FRAME_TIMEOUT_MS)
    claude.runTimers(SUBMIT_DELAY_MS)

    assert.deepEqual(claude.writes, [])
  })
}

test('lists a new managed Session at the time it started', () => {
  const claude = fakeClaude()
  claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  assert.deepEqual(
    claude.driver.roster().map(({ updatedAt }) => updatedAt),
    [STARTED_AT.toISOString()],
  )
})

test('does not let the parent Claude Session suppress transcript persistence', () => {
  const driver = createClaudeSessionDriver({
    findExecutable: () => '/usr/local/bin/claude',
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    now: () => STARTED_AT,
    schedule: (callback) => callback(),
    spawn: (_command, _arguments, options) => {
      assert.equal(options.env.CLAUDE_CODE_CHILD_SESSION, undefined)
      return { write: () => {}, onData: () => {} }
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
