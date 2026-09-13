import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { accessSync, constants } from 'node:fs'
import * as path from 'node:path'
import * as pty from 'node-pty'

import type { SessionRosterRow } from '@/core/sessions/models'
import { createClaudeSessionDriver, SUBMIT_DELAY_MS } from './claude-session-driver'
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

export function createSystemClaudeSessionDriver(permissionRoot: string) {
  const gate = createClaudePermissionGate(permissionRoot)
  const driver = createClaudeSessionDriver({
    findExecutable: claudeExecutable,
    mintSessionId: randomUUID,
    schedule: (callback) => {
      setTimeout(callback, SUBMIT_DELAY_MS)
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
  }
}
