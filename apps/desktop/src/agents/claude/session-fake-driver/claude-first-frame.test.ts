import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createClaudeSessionDriver } from '../drive/claude-session-driver.ts'
import { createOwnershipLedger } from '../drive/ownership-ledger.ts'
import { FIRST_FRAME_TIMEOUT_MS, SUBMIT_DELAY_MS } from '../drive/turn-queue.ts'
import { ledgerFile, ownedBeforeRestart, PASTED, STARTED_AT } from './claude-driver-launch.ts'

const FIRST_FRAME = '\u001b[?2026h\u001b[?25l> \u001b[?25h\u001b[?2026l'

// A `claude` that draws only when told to, on a clock that moves only when told to.
function fakeClaude(file: string) {
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
    ledger: createOwnershipLedger({
      path: file,
      owner: { pid: process.pid, registry: 'window-a' },
      isAlive: (pid) => pid === process.pid,
    }),
    resumeTarget: async () => ({ cwd: '/projects/argo', tipId: 'tip-session' }),
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

test('holds the opening Turn until Claude draws its first frame', async (context) => {
  const claude = fakeClaude(await ledgerFile(context))
  claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  claude.emit('\u001b[?2004h\u001b[?1004h')
  assert.deepEqual(claude.writes, [])

  claude.emit(FIRST_FRAME)
  claude.runTimers(SUBMIT_DELAY_MS)
  assert.deepEqual(claude.writes, PASTED('Inspect the failing test.'))
})

test('recognises a first frame split across two output chunks', async (context) => {
  const claude = fakeClaude(await ledgerFile(context))
  claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  claude.emit('\u001b[?2026h> \u001b[?20')
  claude.emit('26l')
  claude.runTimers(SUBMIT_DELAY_MS)

  assert.deepEqual(claude.writes, PASTED('Inspect the failing test.'))
})

test('sends a follow-up held before the first frame after the opening Turn', async (context) => {
  const claude = fakeClaude(await ledgerFile(context))
  const sessionId = claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the test.' })
  await claude.driver.send(sessionId, 'Then fix it.')

  claude.emit(FIRST_FRAME)
  claude.runTimers(SUBMIT_DELAY_MS)
  claude.runTimers(SUBMIT_DELAY_MS)

  assert.deepEqual(claude.writes, [...PASTED('Inspect the test.'), ...PASTED('Then fix it.')])
})

test('holds the Turn that resumes a Session until Claude draws its first frame', async (context) => {
  const file = await ledgerFile(context)
  ownedBeforeRestart(file, 'resumed-session')
  const claude = fakeClaude(file)
  await claude.driver.send('resumed-session', 'Carry on.')
  assert.deepEqual(claude.writes, [])

  claude.emit(FIRST_FRAME)
  claude.runTimers(SUBMIT_DELAY_MS)
  assert.deepEqual(claude.writes, PASTED('Carry on.'))
})

test('sends the opening Turn when Claude draws no frame within the time limit', async (context) => {
  const claude = fakeClaude(await ledgerFile(context))
  claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

  claude.runTimers(FIRST_FRAME_TIMEOUT_MS)
  claude.runTimers(SUBMIT_DELAY_MS)
  claude.emit(FIRST_FRAME)
  claude.runTimers(SUBMIT_DELAY_MS)

  assert.deepEqual(claude.writes, PASTED('Inspect the failing test.'))
})

for (const [ending, end] of [
  ['exits', (claude: ReturnType<typeof fakeClaude>) => claude.exit()],
  ['is closed', (claude: ReturnType<typeof fakeClaude>) => claude.driver.close()],
] as const) {
  test(`writes nothing to a Claude Session that ${ending} before its opening Turn is sent`, async (context) => {
    const claude = fakeClaude(await ledgerFile(context))
    claude.driver.start({ cwd: '/projects/argo', prompt: 'Inspect the failing test.' })

    end(claude)
    claude.runTimers(FIRST_FRAME_TIMEOUT_MS)
    claude.runTimers(SUBMIT_DELAY_MS)

    assert.deepEqual(claude.writes, [])
  })
}
