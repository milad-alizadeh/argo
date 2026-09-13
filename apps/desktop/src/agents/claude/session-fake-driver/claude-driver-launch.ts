import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { TestContext } from 'node:test'

import { createClaudeSessionDriver } from '../drive/claude-session-driver.ts'
import type { ResumeTarget } from '../drive/drive-channel.ts'
import { createOwnershipLedger } from '../drive/ownership-ledger.ts'

type Spawned = { command: string; commandArguments: string[]; cwd: string; writes: string[] }
type Launch = { spawned: Spawned[]; exit: (index: number) => void }

export async function ledgerFile(context: TestContext) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-driver-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  return path.join(folder, 'claude-session-ownership.json')
}

// One Argo launch: a ledger for this window, and a spawn that records each process it opened.
export function launch(
  file: string,
  options: {
    registry?: string
    resumeTarget?: (sessionId: string) => Promise<ResumeTarget | null>
    findExecutable?: () => string | null
    spawnFails?: boolean
  } = {},
) {
  const spawned: Spawned[] = []
  const exits: Array<() => unknown> = []
  // What each Session's MessageDisplay hook would deliver, keyed by Session.
  const displays = new Map<string, (batch: unknown) => void>()
  const ledger = createOwnershipLedger({
    path: file,
    owner: { pid: process.pid, registry: options.registry ?? 'window-a' },
    isAlive: (pid) => pid === process.pid,
  })
  const driver = createClaudeSessionDriver({
    findExecutable: options.findExecutable ?? (() => '/usr/local/bin/claude'),
    mintSessionId: () => 'a4d56b96-c754-4cce-a68a-4fdbf41a3e2c',
    schedule: (callback) => callback(),
    ledger,
    resumeTarget:
      options.resumeTarget ?? (async () => ({ cwd: '/projects/argo', tipId: 'tip-session' })),
    spawn: (command, commandArguments, spawnOptions) => {
      if (options.spawnFails) throw new Error('spawn failed')
      const record = { command, commandArguments, cwd: spawnOptions.cwd, writes: [] as string[] }
      spawned.push(record)
      return {
        write: (text) => record.writes.push(text),
        onExit: (listener) => exits.push(listener),
      }
    },
    prepare: (sessionId, record) => {
      displays.set(sessionId, record)
      return { commandArguments: [], close: () => {} }
    },
  })
  const state: Launch = { spawned, exit: (index) => exits[index]?.() }
  const display = (sessionId: string, batch: unknown) => displays.get(sessionId)?.(batch)
  return { driver, ledger, display, ...state }
}

// A Session a previous launch started and released when it quit.
export function ownedBeforeRestart(file: string, sessionId: string) {
  const before = createOwnershipLedger({
    path: file,
    owner: { pid: 1, registry: 'previous-launch' },
    isAlive: () => false,
  })
  before.bind(sessionId)
  before.release(sessionId)
}

export const PASTED = (text: string) => [`\u001b[200~${text}\u001b[201~`, '\r']
