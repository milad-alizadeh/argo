import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { createOwnershipLedger, isProcessAlive } from '@/domains/sessions/main'
import { codexResumeTarget } from '../sessions'
import { findExecutableOnLoginShellPath } from '@/harnesses/executable-path'
import { createCodexSessionDriver } from './codex-session-driver'
import { openAppServer } from './open-app-server'

// The transport ADR-0024 and #1826 resolved: `codex app-server --listen stdio://`, spawned with
// separate stdin/stdout/stderr pipes. Terminal escapes, bracketed paste and resize do not belong
// on this channel, unlike the Claude adapter's PTY.
//
// `item/tool/requestUserInput` (#1841) sits behind `features.default_mode_request_user_input`,
// `false` (and marked "under development") in a stock `codex features list`; live-verified against
// codex-harness 0.147.0 that this override actually turns the tool on for the model to call, not just
// a schema that never fires.
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
      return openAppServer({ executable, cwd: options.cwd, env: options.env }).channel
    },
  })
}
