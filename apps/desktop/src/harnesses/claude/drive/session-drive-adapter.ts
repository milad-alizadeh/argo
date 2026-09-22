import type { Permission, PermissionDecision } from '@/domains/sessions/contract/drive/permission'
import {
  type ClaudePermission,
  claudeTurnSetupSchema,
} from '@/domains/sessions/contract/ipc/contract'
import type {
  DriveFailure,
  SessionDriveAdapter,
} from '@/domains/sessions/contract/session-drive-adapter'
import { embedAttachments, mentionableAttachments } from './attachment-prompt'
import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'
import type { ClaudePermissionDecision } from './permission-gate'

const FAILURE_MESSAGES = {
  'harness-unavailable': 'Claude Code is not available. Run claude doctor to repair it.',
  'launch-failed': 'Argo could not start Claude Code.',
  'not-drivable': 'Argo no longer holds this Claude Session.',
  'held-elsewhere': 'Another Argo window is driving this Claude Session.',
  'stale-permission': 'This Claude permission is no longer waiting.',
  'stale-question': 'This Claude question is no longer waiting.',
} as const

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

const CLAUDE_ADAPTER_BASE = {
  harness: 'claude',
  failureMessage: (code: keyof typeof FAILURE_MESSAGES) => FAILURE_MESSAGES[code],
  turnSetupSchema: claudeTurnSetupSchema,
}

export function createClaudeDriveAdapter(driver: ClaudeSessionDriver): SessionDriveAdapter {
  return {
    ...CLAUDE_ADAPTER_BASE,
    async start({ cwd, prompt, setup, attachments }) {
      const parsedSetup = claudeTurnSetupSchema.safeParse(setup)
      if (!parsedSetup.success) return { error: 'launch-failed' }
      try {
        return {
          sessionId: driver.start({
            cwd,
            prompt: embedAttachments(prompt, await mentionableAttachments(attachments)),
            setup: parsedSetup.data,
          }),
        }
      } catch (error) {
        return failureOf(error, 'launch-failed')
      }
    },
    async send({ sessionId, prompt, setup, attachments }) {
      const parsedSetup = claudeTurnSetupSchema.safeParse(setup)
      if (!parsedSetup.success) return { error: 'not-drivable' }
      try {
        await driver.send(sessionId, {
          prompt: embedAttachments(prompt, await mentionableAttachments(attachments)),
          setup: parsedSetup.data,
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
