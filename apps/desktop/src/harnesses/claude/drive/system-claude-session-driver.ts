import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import * as pty from 'node-pty'
import { createOwnershipLedger, isProcessAlive } from '@/domains/sessions/main'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { claudeResumeTarget } from '../sessions/discovery/resume-target'
import { claudePendingQuestion } from '../sessions/subagents/pending-question'
import { createClaudeSessionDriver } from './claude-session-driver'
import { createHandoffLedger } from './handoff/handoff-ledger'
import { createClaudePermissionGate } from './permission/permission-gate'
import { createMessageDisplay } from './turn/message-display'

function readHandoffBrief(briefPath: string): string | null {
  try {
    return readFileSync(briefPath, 'utf8')
  } catch {
    return null
  }
}

export function createSystemClaudeSessionDriver(paths: {
  permissions: string
  ledger: string
  transcripts: string
  // Where a handing-off Session's brief lands, and the durable edge a completed handoff records.
  handoffBriefs: string
  handoffLedger: string
  // A proof names its mock `claude` here; a person's launch finds the real one on the login PATH.
  executable?: string
}) {
  const display = createMessageDisplay()
  const handoffLedger = createHandoffLedger({ path: paths.handoffLedger })
  const driver = createClaudeSessionDriver({
    findExecutable: () => paths.executable ?? findExecutableOnLoginShellPath('claude'),
    mintSessionId: randomUUID,
    now: () => new Date(),
    ledger: createOwnershipLedger({
      path: paths.ledger,
      window: { pid: process.pid, registry: randomUUID() },
      isAlive: isProcessAlive,
    }),
    resumeTarget: (sessionId) => claudeResumeTarget(paths.transcripts, sessionId),
    handoffRoot: paths.handoffBriefs,
    readHandoffBrief,
    handoffLedger,
    pendingQuestion: (sessionId) => claudePendingQuestion(paths.transcripts, sessionId),
    schedule: (callback, milliseconds) => {
      setTimeout(callback, milliseconds)
    },
    spawn: (command, commandArguments, options) =>
      pty.spawn(command, commandArguments, {
        cols: 80,
        cwd: options.cwd,
        env: options.env,
        name: 'xterm-256color',
        rows: 24,
      }),
    gate: createClaudePermissionGate(),
    pluginRoot: paths.permissions,
    extraParts: (sessionId, record) => [display.open(sessionId, record)],
  })
  return {
    ...driver,
    handoffEdges: handoffLedger.edgesFor,
    async close() {
      await driver.close()
      display.close()
    },
  }
}
