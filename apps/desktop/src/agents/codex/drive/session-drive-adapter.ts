import { z } from 'zod'
import type { DriveFailure, SessionDriveAdapter } from '@/core/sessions/session-drive-adapter'
import type { CodexSessionDriver } from './codex-session-driver'
import { CodexSessionDriverError } from './codex-session-error'

// Codex declares no Turn setup yet (#1885 is out of scope): any value the composer sends is
// refused with `invalid-request` because only `undefined` parses.
const codexTurnSetupSchema = z.undefined()

function failureOf(error: unknown, fallback: DriveFailure['error']): DriveFailure {
  return { error: error instanceof CodexSessionDriverError ? error.code : fallback }
}

export function createCodexDriveAdapter(driver: CodexSessionDriver): SessionDriveAdapter {
  return {
    cli: 'codex',
    turnSetupSchema: codexTurnSetupSchema,
    async start({ cwd, prompt }) {
      try {
        return { sessionId: await driver.start({ cwd, prompt }) }
      } catch (error) {
        return failureOf(error, 'launch-failed')
      }
    },
    async send({ sessionId, prompt }) {
      try {
        await driver.send(sessionId, prompt)
        return { ok: true }
      } catch (error) {
        return failureOf(error, 'not-drivable')
      }
    },
    async interrupt({ sessionId }) {
      try {
        await driver.interrupt(sessionId)
        return { ok: true }
      } catch (error) {
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
