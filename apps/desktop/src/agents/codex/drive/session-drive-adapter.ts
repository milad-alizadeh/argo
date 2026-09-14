import { type CodexTurnSetup, codexTurnSetupSchema } from '@/core/sessions/codex-contract'
import type { DriveFailure, SessionDriveAdapter } from '@/core/sessions/session-drive-adapter'
import type { CodexSessionDriver } from './codex-session-driver'
import { CodexSessionDriverError } from './codex-session-error'

// `codex app-server` refuses a thread already active in another process (its own client or the
// standalone Codex app) with a JSON-RPC error naming that fact; every other refusal falls back to
// the caller's own code. The exact wording still needs a live repro against a held Session (#2053)
// to replace this heuristic with the real one.
const ACTIVE_ELSEWHERE = /already active|in use|held by|another (client|session|instance)/i

function failureOf(error: unknown, fallback: DriveFailure['error']): DriveFailure {
  if (error instanceof CodexSessionDriverError) return { error: error.code }
  const message = error instanceof Error ? error.message : ''
  if (ACTIVE_ELSEWHERE.test(message)) return { error: 'held-elsewhere' }
  return { error: fallback }
}

export function createCodexDriveAdapter(driver: CodexSessionDriver): SessionDriveAdapter {
  return {
    cli: 'codex',
    turnSetupSchema: codexTurnSetupSchema,
    async start({ cwd, prompt, setup }) {
      try {
        return { sessionId: await driver.start({ cwd, prompt, setup: setup as CodexTurnSetup }) }
      } catch (error) {
        return failureOf(error, 'launch-failed')
      }
    },
    async send({ sessionId, prompt, setup }) {
      try {
        await driver.send(sessionId, prompt, setup as CodexTurnSetup)
        return { ok: true }
      } catch (error) {
        console.error('Argo could not send to Codex Session', sessionId, error)
        return failureOf(error, 'not-drivable')
      }
    },
    async interrupt({ sessionId }) {
      try {
        await driver.interrupt(sessionId)
        return { ok: true }
      } catch (error) {
        console.error('Argo could not interrupt Codex Session', sessionId, error)
        return failureOf(error, 'not-drivable')
      }
    },
    async compact() {
      return { error: 'not-drivable' }
    },
    // Codex Permissions are #1841, still out of scope: there is never a pending Permission to
    // read, and a decision always answers that it is no longer waiting.
    async readPermission() {
      return { permission: null }
    },
    async decidePermission() {
      return { error: 'stale-permission' }
    },
  }
}
