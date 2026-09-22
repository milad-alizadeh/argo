import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createOwnershipLedger } from '@/domains/sessions/main/lifecycle/ownership-ledger.ts'
import { createClaudeSessionDriver } from '@/harnesses/claude/drive/claude-session-driver.ts'
import { FIRST_FRAME_TIMEOUT_MS } from '@/harnesses/claude/drive/first-frame.ts'
import {
  ledgerFile,
  mockPermissionGate,
  OPENING,
  ownedBeforeRestart,
  PASTED,
  STARTED_AT,
  settle,
} from './claude-driver-launch.ts'

const FIRST_FRAME = '\u001b[?2026h\u001b[?25l> \u001b[?25h\u001b[?2026l'
const turn = (prompt: string) => ({ prompt, setup: OPENING })

// A `claude` that draws only when told to, on a clock that moves only when told to.
function mockClaude(file: string) {
  const writes: string[] = []
  let timers: { callback: () => void; delay: number }[] = []
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
      window: { pid: process.pid, registry: 'window-a' },
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
    gate: mockPermissionGate(),
    pluginRoot: mkdtempSync(path.join(os.tmpdir(), 'argo-claude-plugins-')),
  })
  const fire = (due: (delay: number) => boolean) => {
    const firing = timers.filter((timer) => due(timer.delay))
    timers = timers.filter((timer) => !due(timer.delay))
    for (const timer of firing) timer.callback()
    return firing.length
  }
  // Lets every pause inside a Turn run out, but never the wait for the first frame.
  const typeOut = async (): Promise<void> => {
    await settle()
    if (fire((delay) => delay !== FIRST_FRAME_TIMEOUT_MS) > 0) await typeOut()
  }
  return {
    driver,
    writes,
    typeOut,
    emit: (data: string) => emit(data),
    exit: () => exit(),
    timeOut: () => fire((delay) => delay === FIRST_FRAME_TIMEOUT_MS),
  }
}

test('holds the opening Turn until Claude draws its first frame', async (context) => {
  const claude = mockClaude(await ledgerFile(context))
  claude.driver.start({ cwd: '/projects/argo', ...turn('Inspect the failing test.') })

  claude.emit('\u001b[?2004h\u001b[?1004h')
  await claude.typeOut()
  assert.deepEqual(claude.writes, [])

  claude.emit(FIRST_FRAME)
  await claude.typeOut()
  assert.deepEqual(claude.writes, PASTED('Inspect the failing test.'))
})

test('recognises a first frame split across two output chunks', async (context) => {
  const claude = mockClaude(await ledgerFile(context))
  claude.driver.start({ cwd: '/projects/argo', ...turn('Inspect the failing test.') })

  claude.emit('\u001b[?2026h> \u001b[?20')
  claude.emit('26l')
  await claude.typeOut()

  assert.deepEqual(claude.writes, PASTED('Inspect the failing test.'))
})

test('sends a follow-up held before the first frame after the opening Turn', async (context) => {
  const claude = mockClaude(await ledgerFile(context))
  const sessionId = claude.driver.start({ cwd: '/projects/argo', ...turn('Inspect the test.') })
  const followUp = claude.driver.send(sessionId, turn('Then fix it.'))

  claude.emit(FIRST_FRAME)
  await claude.typeOut()
  await followUp

  assert.deepEqual(claude.writes, [...PASTED('Inspect the test.'), ...PASTED('Then fix it.')])
})

test('holds the Turn that resumes a Session until Claude draws its first frame', async (context) => {
  const file = await ledgerFile(context)
  ownedBeforeRestart(file, 'resumed-session')
  const claude = mockClaude(file)
  const resumed = claude.driver.send('resumed-session', turn('Carry on.'))
  await claude.typeOut()
  assert.deepEqual(claude.writes, [])

  claude.emit(FIRST_FRAME)
  await claude.typeOut()
  await resumed
  assert.deepEqual(claude.writes, PASTED('Carry on.'))
})

test('sends the opening Turn when Claude draws no frame within the time limit', async (context) => {
  const claude = mockClaude(await ledgerFile(context))
  claude.driver.start({ cwd: '/projects/argo', ...turn('Inspect the failing test.') })

  claude.timeOut()
  await claude.typeOut()
  claude.emit(FIRST_FRAME)
  await claude.typeOut()

  assert.deepEqual(claude.writes, PASTED('Inspect the failing test.'))
})

test('stops typing a Turn when Claude exits between the paste and Return', async (context) => {
  const claude = mockClaude(await ledgerFile(context))
  claude.driver.start({ cwd: '/projects/argo', ...turn('Inspect the failing test.') })

  claude.emit(FIRST_FRAME)
  await settle()
  claude.exit()
  await claude.typeOut()

  assert.deepEqual(claude.writes, PASTED('Inspect the failing test.').slice(0, 1))
})

for (const [ending, end] of [
  ['exits', (claude: ReturnType<typeof mockClaude>) => claude.exit()],
  ['is closed', (claude: ReturnType<typeof mockClaude>) => claude.driver.close()],
] as const) {
  test(`writes nothing to a Claude Session that ${ending} before its opening Turn is sent`, async (context) => {
    const claude = mockClaude(await ledgerFile(context))
    claude.driver.start({ cwd: '/projects/argo', ...turn('Inspect the failing test.') })

    end(claude)
    claude.timeOut()
    await claude.typeOut()

    assert.deepEqual(claude.writes, [])
  })
}
