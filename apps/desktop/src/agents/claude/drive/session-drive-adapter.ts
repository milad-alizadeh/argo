import {
  type ClaudePermission,
  type ClaudeTurnSetup,
  claudeTurnSetupSchema,
} from '@/core/sessions/contract'
import type { Permission, PermissionDecision } from '@/core/sessions/permission'
import type { DriveFailure, SessionDriveAdapter } from '@/core/sessions/session-drive-adapter'
import { embedAttachments, mentionableAttachments } from './attachment-prompt'
import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'
import type { ClaudePermissionDecision } from './permission-gate'

function failureOf(error: unknown, fallback: DriveFailure['error']): DriveFailure {
  return { error: error instanceof ClaudeSessionDriverError ? error.code : fallback }
}

// Claude's own vocabulary, mapped onto the shared Permission at this adapter's boundary: nothing
// outside this directory reads `toolName`/`input`.
function toPermission({ id, sessionId, toolName, input }: ClaudePermission): Permission {
  return { id, sessionId, description: `${toolName} ${JSON.stringify(input)}` }
}

// Claude's hook answers only `allow` or `deny`, so the gate keeps a session-scoped allow as a rule
// for similar calls (ADR-0024 amended). A cancel has no Turn-interrupt meaning for a PreToolUse
// hook, so it collapses to deny.
const CLAUDE_DECISIONS: Record<PermissionDecision, ClaudePermissionDecision> = {
  allow: 'allow',
  deny: 'deny',
  allowForSession: 'allowSimilar',
  cancel: 'deny',
}

export function createClaudeDriveAdapter(driver: ClaudeSessionDriver): SessionDriveAdapter {
  return {
    cli: 'claude',
    turnSetupSchema: claudeTurnSetupSchema,
    async start({ cwd, prompt, setup, attachments }) {
      try {
        return {
          sessionId: driver.start({
            cwd,
            prompt: embedAttachments(prompt, await mentionableAttachments(attachments)),
            setup: setup as ClaudeTurnSetup,
          }),
        }
      } catch (error) {
        return failureOf(error, 'launch-failed')
      }
    },
    async send({ sessionId, prompt, setup, attachments }) {
      try {
        await driver.send(sessionId, {
          prompt: embedAttachments(prompt, await mentionableAttachments(attachments)),
          setup: setup as ClaudeTurnSetup,
        })
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
    async handoff({ sessionId }) {
      try {
        await driver.handoff(sessionId)
        return { ok: true }
      } catch (error) {
        return failureOf(error, 'not-drivable')
      }
    },
    async readPermission({ sessionId }) {
      const permission = driver.pendingPermission(sessionId)
      return { permission: permission === null ? null : toPermission(permission) }
    },
    watchPermissions: driver.watchPermissions,
    async decidePermission({ sessionId, permissionId, decision }) {
      if (!driver.decidePermission(sessionId, permissionId, CLAUDE_DECISIONS[decision])) {
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
