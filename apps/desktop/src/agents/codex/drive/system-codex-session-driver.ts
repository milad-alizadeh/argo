import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import * as path from 'node:path'

import { openCodexChannel } from './codex-channel'
import { createCodexSessionDriver } from './codex-session-driver'

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

function codexExecutable(): string | null {
  return (
    loginShellPath()
      .split(path.delimiter)
      .map((directory) => path.join(directory, 'codex'))
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

// The transport ADR-0024 and #1826 resolved: `codex app-server --listen stdio://`, spawned with
// separate stdin/stdout/stderr pipes. Terminal escapes, bracketed paste and resize do not belong
// on this channel, unlike the Claude adapter's PTY.
function spawnCodex(
  executable: string,
  options: { cwd: string; env: NodeJS.ProcessEnv },
): ChildProcessWithoutNullStreams {
  return spawn(executable, ['app-server', '--listen', 'stdio://'], {
    cwd: options.cwd,
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

export function createSystemCodexSessionDriver() {
  return createCodexSessionDriver({
    findExecutable: codexExecutable,
    openChannel: (executable, options) => {
      const child = spawnCodex(executable, options)
      child.stderr.on('data', () => {})
      return openCodexChannel({
        stdout: child.stdout,
        write: (line) => {
          child.stdin.write(line)
        },
        kill: () => {
          child.kill()
        },
        onExit: (listener) => {
          child.on('close', listener)
          child.on('error', listener)
        },
      })
    },
  })
}
