import {
  type ClaudePermission,
  type ClaudeTurnSetup,
  claudeTurnSetupSchema,
} from '@/core/sessions/contract'
import type { Permission, PermissionDecision } from '@/core/sessions/permission'
import type { DriveFailure, SessionDriveAdapter } from '@/core/sessions/session-drive-adapter'
import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'

function failureOf(error: unknown, fallback: DriveFailure['error']): DriveFailure {
  return { error: error instanceof ClaudeSessionDriverError ? error.code : fallback }
}

// Claude's own vocabulary, mapped onto the shared Permission at this adapter's boundary: nothing
// outside this directory reads `toolName`/`input`.
function toPermission({ id, sessionId, toolName, input }: ClaudePermission): Permission {
  return { id, sessionId, description: `${toolName} ${JSON.stringify(input)}` }
}

// Claude's hook answers only `allow` or `deny` (ADR-0024): a session-scoped allow has no session
// to stand on here, and a cancel has no Turn-interrupt meaning for a PreToolUse hook, so both
// collapse to the decision they read closest to.
const CLAUDE_DECISIONS: Record<PermissionDecision, 'allow' | 'deny'> = {
  allow: 'allow',
  deny: 'deny',
  allowForSession: 'allow',
  cancel: 'deny',
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
      const permission = driver.pendingPermission(sessionId)
      return { permission: permission === null ? null : toPermission(permission) }
    },
    async decidePermission({ sessionId, permissionId, decision }) {
      if (!driver.decidePermission(sessionId, permissionId, CLAUDE_DECISIONS[decision])) {
        return { error: 'stale-permission' }
      }
      return { ok: true }
    },
  }
}
