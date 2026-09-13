import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'

import { findExecutableOnLoginShellPath } from '../../executable-path'
import { openCodexChannel } from './codex-channel'
import { createCodexSessionDriver } from './codex-session-driver'

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
    findExecutable: () => findExecutableOnLoginShellPath('codex'),
    now: () => new Date(),
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
