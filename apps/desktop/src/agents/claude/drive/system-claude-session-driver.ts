import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { accessSync, constants } from 'node:fs'
import * as path from 'node:path'
import * as pty from 'node-pty'

import type { SessionRosterRow } from '@/core/sessions/models'
import { claudeResumeTarget } from '../sessions/resume-target'
import { createClaudeSessionDriver } from './claude-session-driver'
import { createOwnershipLedger, isProcessAlive } from './ownership-ledger'
import { createClaudePermissionGate } from './permission-gate'

function loginShellPath(): string {
  const shell = process.env.SHELL
  if (!shell) return process.env.PATH ?? '/usr/bin:/bin'
  try {
    const output = execFileSync(shell, ['-ilc', 'printf \'%s\\n\' "$PATH"'], {
      encoding: 'utf8',
    })
    return output.trim().split('\n').at(-1) || (process.env.PATH ?? '/usr/bin:/bin')
  } catch {
    return process.env.PATH ?? '/usr/bin:/bin'
  }
}

function claudeExecutable(): string | null {
  return (
    loginShellPath()
      .split(path.delimiter)
      .map((directory) => path.join(directory, 'claude'))
      .find((candidate) => {
        try {
          accessSync(candidate, constants.X_OK)
          return true
        } catch {
          return false
        }
      }) ?? null
  )
}

export function createSystemClaudeSessionDriver(paths: {
  permissions: string
  ledger: string
  transcripts: string
  // A proof names its fake `claude` here; a person's launch finds the real one on the login PATH.
  executable?: string
}) {
  const gate = createClaudePermissionGate(paths.permissions)
  const driver = createClaudeSessionDriver({
    findExecutable: () => paths.executable ?? claudeExecutable(),
    mintSessionId: randomUUID,
    ledger: createOwnershipLedger({
      path: paths.ledger,
      owner: { pid: process.pid, registry: randomUUID() },
      isAlive: isProcessAlive,
    }),
    resumeTarget: (sessionId) => claudeResumeTarget(paths.transcripts, sessionId),
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
    prepare: (sessionId) => {
      const plugin = gate.open(sessionId)
      return { commandArguments: ['--plugin-dir', plugin.pluginRoot], close: plugin.close }
    },
  })
  return {
    ...driver,
    roster: (): SessionRosterRow[] =>
      driver
        .roster()
        .map((session) =>
          gate.pending(session.id) === null ? session : { ...session, status: 'permission' },
        ),
    pendingPermission: gate.pending,
    decidePermission: gate.decide,
    close() {
      driver.close()
      gate.close()
    },
  }
}
