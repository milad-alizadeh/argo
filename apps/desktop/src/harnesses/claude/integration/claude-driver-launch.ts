import { mkdtempSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/ipc/contract.ts'
import { createOwnershipLedger } from '@/domains/sessions/main/lifecycle/ownership-ledger.ts'
import { createClaudeSessionDriver } from '@/harnesses/claude/drive/claude-session-driver.ts'
import type { ResumeTarget } from '@/harnesses/claude/drive/drive-channel.ts'
import { createHandoffLedger, type HandoffLedger } from '@/harnesses/claude/drive/handoff-ledger.ts'
import type { ClaudePermissionGate } from '@/harnesses/claude/drive/permission-gate.ts'
import { mockPermissionGate } from './claude-permission-gate-mock.ts'
import { FOOTERS, terminal } from './claude-terminal-mock.ts'

export { FOOTERS, mockPermissionGate }
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
    schedule?: (callback: () => void, milliseconds: number) => void
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
    schedule: options.schedule ?? ((callback) => callback()),
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
