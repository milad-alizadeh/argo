import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import {
  createOwnershipLedger,
  isProcessAlive,
} from '@/domains/sessions/main/lifecycle/ownership-ledger'
import { openCodexChannel } from '@/harnesses/codex/drive/codex-channel'
import { createCodexSessionDriver } from '@/harnesses/codex/drive/codex-session-driver'
import { codexResumeTarget } from '@/harnesses/codex/sessions/resume-target'
import { findExecutableOnLoginShellPath } from '@/harnesses/executable-path'

// The transport ADR-0024 and #1826 resolved: `codex app-server --listen stdio://`, spawned with
// separate stdin/stdout/stderr pipes. Terminal escapes, bracketed paste and resize do not belong
// on this channel, unlike the Claude adapter's PTY.
//
// `item/tool/requestUserInput` (#1841) sits behind `features.default_mode_request_user_input`,
// `false` (and marked "under development") in a stock `codex features list`; live-verified against
// codex-harness 0.147.0 that this override actually turns the tool on for the model to call, not just
// a schema that never fires.
function spawnCodex(
  executable: string,
  options: { cwd: string; env: NodeJS.ProcessEnv },
): ChildProcessWithoutNullStreams {
  return spawn(
    executable,
    ['app-server', '--listen', 'stdio://', '-c', 'features.default_mode_request_user_input=true'],
    {
      cwd: options.cwd,
      env: options.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  )
}

export function createSystemCodexSessionDriver(paths: {
  executable?: string
  ownership: string
  transcripts: string
}) {
  return createCodexSessionDriver({
    findExecutable: () => paths.executable ?? findExecutableOnLoginShellPath('codex'),
    now: () => new Date(),
    ownership: createOwnershipLedger({
      path: paths.ownership,
      window: { pid: process.pid, registry: randomUUID() },
      isAlive: isProcessAlive,
    }),
    resumeTarget: (sessionId) => codexResumeTarget(paths.transcripts, sessionId),
    openChannel: (executable, options) => {
      const child = spawnCodex(executable, options)
      // `codex app-server` prints its own diagnostics here; kept in the log rather than thrown
      // away, since a refusal on the JSON-RPC channel rarely says why on its own (#2053).
      child.stderr.on('data', (chunk: Buffer) => {
        console.error(`codex app-server stderr: ${chunk.toString('utf8').trimEnd()}`)
      })
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
