import { mkdtempSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'
import { createClaudeSessionDriver } from '@/harnesses/claude/drive/claude-session-driver.ts'
import { CYCLE_MODE, REDRAW } from '@/harnesses/claude/drive/claude-setup.ts'
import type { ResumeTarget } from '@/harnesses/claude/drive/drive-channel.ts'
import { createHandoffLedger, type HandoffLedger } from '@/harnesses/claude/drive/handoff-ledger.ts'
import type { ClaudePermissionGate } from '@/harnesses/claude/drive/permission-gate.ts'
import { createOwnershipLedger } from '@/harnesses/ownership-ledger.ts'

export const STARTED_AT = new Date('2026-09-13T15:17:11.000Z')

type Spawned = {
  command: string
  commandArguments: string[]
  cwd: string
  environment: NodeJS.ProcessEnv
  writes: string[]
}
type Launch = { spawned: Spawned[]; exit: (index: number) => void }

export const OPENING: ClaudeTurnSetup = { model: 'opus', effort: 'high', mode: 'manual' }
// The Modes this mock offers, in the order Shift+Tab reaches them.
export const FOOTERS = ['manual mode on', 'accept edits on', 'plan mode on', 'auto mode on']

export async function ledgerFile(context: TestContext) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-driver-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  return path.join(folder, 'claude-session-ownership.json')
}

export async function handoffLedgerFile(context: TestContext) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-handoffs-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  return path.join(folder, 'claude-session-handoffs.json')
}

// A gate that never raises a Permission, for a test with nothing to say about Permission behavior.
// It still writes a real (inert) hook into the plugin, the way the real gate's `open` would.
export function mockPermissionGate(): ClaudePermissionGate {
  return {
    open: () => ({
      hook: { event: 'PreToolUse', file: 'permission-hook.sh', script: '' },
      close: () => {},
    }),
    pending: () => null,
    decide: () => false,
    onChanged: () => () => {},
    close: () => {},
  }
}

// One Argo launch: a ledger for this window, and a spawn that records each process it opened. Each
// process is a Claude TUI that redraws its Mode footer on Ctrl+L, one Mode on per Shift+Tab.
export function launch(
  file: string,
  options: {
    registry?: string
    resumeTarget?: (sessionId: string) => Promise<ResumeTarget | null>
    pendingQuestion?: (sessionId: string) => Promise<{ id: string } | null>
    findExecutable?: () => string | null
    spawnFails?: boolean
    gate?: ClaudePermissionGate
    mintSessionId?: () => string
    now?: () => Date
    handoffRoot?: string
    handoffLedger?: HandoffLedger
    readHandoffBrief?: (briefPath: string) => string | null
    handoffPatienceMs?: number
  } = {},
) {
  const spawned: Spawned[] = []
  const exits: Array<() => unknown> = []
  // What each process draws on its own, unprompted, the way a spinner repaints.
  const paints: Array<(data: string) => void> = []
  // What each Session's MessageDisplay hook would deliver, keyed by Session.
  const displays = new Map<string, (batch: unknown) => void>()
  const ledger = createOwnershipLedger({
    path: file,
    window: { pid: process.pid, registry: options.registry ?? 'window-a' },
    isAlive: (pid) => pid === process.pid,
  })
  const handoffLedger =
    options.handoffLedger ??
    createHandoffLedger({ path: path.join(path.dirname(file), 'claude-session-handoffs.json') })
  const pluginRoot = mkdtempSync(path.join(os.tmpdir(), 'argo-claude-plugins-'))
  const driver = createClaudeSessionDriver({
    findExecutable: options.findExecutable ?? (() => '/usr/local/bin/claude'),
    mintSessionId: options.mintSessionId ?? (() => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c'),
    now: options.now ?? (() => STARTED_AT),
    schedule: (callback) => callback(),
    ledger,
    resumeTarget:
      options.resumeTarget ?? (async () => ({ cwd: '/projects/argo', tipId: 'tip-session' })),
    pendingQuestion: options.pendingQuestion ?? (async () => null),
    spawn: (command, commandArguments, spawnOptions) => {
      if (options.spawnFails) throw new Error('spawn failed')
      const { cwd, env: environment } = spawnOptions
      const record = { command, commandArguments, cwd, environment, writes: [] as string[] }
      spawned.push(record)
      const process = terminal(record.writes)
      paints.push(process.paint)
      return { ...process, onExit: (listener) => exits.push(listener) }
    },
    gate: options.gate ?? mockPermissionGate(),
    pluginRoot,
    extraParts: (sessionId, record) => {
      displays.set(sessionId, record)
      return []
    },
    handoffRoot: options.handoffRoot ?? '/handoffs',
    handoffLedger,
    readHandoffBrief: options.readHandoffBrief ?? (() => null),
    handoffPatienceMs: options.handoffPatienceMs,
  })
  const state: Launch = { spawned, exit: (index) => exits[index]?.() }
  const display = (sessionId: string, batch: unknown) => displays.get(sessionId)?.(batch)
  const paint = (index: number, data: string) => paints[index]?.(data)
  return { driver, ledger, handoffLedger, display, paint, pluginRoot, ...state }
}

// A Session a previous launch started and released when it quit.
export function ownedBeforeRestart(file: string, sessionId: string) {
  const before = createOwnershipLedger({
    path: file,
    window: { pid: 1, registry: 'previous-launch' },
    isAlive: () => false,
  })
  before.bind(sessionId)
  before.release(sessionId)
}

export const PASTED = (text: string) => [`\u001b[200~${text}\u001b[201~`, '\r']

export const settle = () => new Promise((resolve) => setImmediate(resolve))

function terminal(writes: string[]) {
  let listener: (data: string) => void = () => {}
  let footer = 0
  return {
    write: (text: string) => {
      writes.push(text)
      if (text === CYCLE_MODE) footer = (footer + 1) % FOOTERS.length
      if (text === REDRAW) listener(`\u001b[2J\u001b[38;5;246m⏵⏵ ${FOOTERS[footer]}\u001b[39m`)
    },
    onData: (next: (data: string) => void) => {
      listener = next
    },
    paint: (data: string) => listener(data),
  }
}

// A started Session whose opening Turn has gone out, with its writes cleared.
export async function startedSession(
  context: TestContext,
  options: Parameters<typeof launch>[1] = {},
) {
  const launched = launch(await ledgerFile(context), options)
  const sessionId = launched.driver.start({
    cwd: '/projects/argo',
    prompt: 'Start.',
    setup: OPENING,
  })
  await settle()
  const writes = launched.spawned[0]?.writes ?? []
  writes.length = 0
  return { ...launched, sessionId, writes }
}
