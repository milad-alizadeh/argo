import { type ClaudeTurnSetup, claudeTurnSetupSchema } from '@/core/sessions/contract'
import type { DriveFailure, SessionDriveAdapter } from '@/core/sessions/session-drive-adapter'
import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'

function failureOf(error: unknown, fallback: DriveFailure['error']): DriveFailure {
  return { error: error instanceof ClaudeSessionDriverError ? error.code : fallback }
}

export function createClaudeDriveAdapter(driver: ClaudeSessionDriver): SessionDriveAdapter {
  return {
    cli: 'claude',
    turnSetupSchema: claudeTurnSetupSchema,
    async start({ cwd, prompt, setup }) {
      try {
        return { sessionId: driver.start({ cwd, prompt, setup: setup as ClaudeTurnSetup }) }
      } catch (error) {
        return failureOf(error, 'launch-failed')
      }
    },
    async send({ sessionId, prompt, setup }) {
      try {
        await driver.send(sessionId, { prompt, setup: setup as ClaudeTurnSetup })
        return { ok: true }
      } catch (error) {
        return failureOf(error, 'not-drivable')
      }
    },
    async interrupt({ sessionId }) {
      try {
        driver.interrupt(sessionId)
        return { ok: true }
      } catch (error) {
        return failureOf(error, 'not-drivable')
      }
    },
    async compact({ sessionId }) {
      try {
        await driver.compact(sessionId)
        return { ok: true }
      } catch (error) {
        return failureOf(error, 'not-drivable')
      }
    },
    async readPermission({ sessionId }) {
      return { permission: driver.pendingPermission(sessionId) }
    },
    async decidePermission({ sessionId, permissionId, decision }) {
      if (!driver.decidePermission(sessionId, permissionId, decision)) {
        return { error: 'stale-permission' }
      }
      return { ok: true }
    },
    async decideQuestion({ sessionId, questionId, answers }) {
      try {
        if (!(await driver.decideQuestion(sessionId, questionId, answers))) {
          return { error: 'stale-question' }
        }
        return { ok: true }
      } catch (error) {
        return failureOf(error, 'not-drivable')
      }
    },
  }
}
