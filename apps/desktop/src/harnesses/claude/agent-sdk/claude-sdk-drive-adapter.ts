import { z } from 'zod'
import type { SessionDriveAdapter } from '@/domains/sessions/contract/session-drive-adapter'
import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'
import type { SessionAdapter } from '@/domains/sessions/next/contract/session-projection-contract'

const ignoredSetupSchema = z.unknown()
const FAILURE_MESSAGES = {
  'harness-unavailable': 'Claude Code is not available. Run claude doctor to repair it.',
  'launch-failed': 'Argo could not start Claude Code.',
  'not-drivable': 'Argo no longer holds this Claude Session.',
  'held-elsewhere': 'Another Argo window is driving this Claude Session.',
  'stale-permission': 'This Claude permission is no longer waiting.',
  'stale-question': 'This Claude question is no longer waiting.',
} as const

function identity(sessionId: string) {
  return { harness: 'claude' as const, nativeId: sessionId }
}

function failed(outcome: Awaited<ReturnType<SessionAdapter['execute']>>) {
  return outcome.kind === 'rejected'
    ? { error: 'not-drivable' as const }
    : { error: 'not-drivable' as const }
}

export function createClaudeSdkDriveAdapter(options: {
  adapter: SessionAdapter
  workspaceForCwd: (cwd: string) => Promise<WorkspaceSelection>
}): SessionDriveAdapter {
  return {
    harness: 'claude',
    failureMessage: (code) => FAILURE_MESSAGES[code],
    turnSetupSchema: ignoredSetupSchema,
    async start({ cwd, prompt, attachments }) {
      if (attachments.length > 0) return { error: 'launch-failed' }
      const outcome = await options.adapter.execute({
        type: 'session.start',
        harness: 'claude',
        prompt,
        workspace: await options.workspaceForCwd(cwd),
      })
      return outcome.kind === 'accepted'
        ? { sessionId: outcome.projection.session.nativeId }
        : failed(outcome)
    },
    async send({ sessionId, prompt, attachments }) {
      if (attachments.length > 0) return { error: 'not-drivable' }
      const outcome = await options.adapter.execute({
        type: 'session.send',
        session: identity(sessionId),
        prompt,
      })
      return outcome.kind === 'accepted' ? { ok: true } : failed(outcome)
    },
    async steer({ sessionId, prompt, attachments }) {
      if (attachments.length > 0) return { error: 'not-drivable' }
      const outcome = await options.adapter.execute({
        type: 'session.steer',
        session: identity(sessionId),
        prompt,
      })
      return outcome.kind === 'accepted' ? { ok: true } : failed(outcome)
    },
    async interrupt({ sessionId }) {
      const outcome = await options.adapter.execute({
        type: 'session.interrupt',
        session: identity(sessionId),
      })
      return outcome.kind === 'accepted' ? { ok: true } : failed(outcome)
    },
    async compact() {
      return { error: 'not-drivable' }
    },
    async handoff() {
      return { error: 'not-drivable' }
    },
    async readPermission() {
      return { permission: null }
    },
    async decidePermission({ sessionId, permissionId, decision }) {
      const outcome = await options.adapter.execute({
        type: 'session.decide',
        session: identity(sessionId),
        approvalId: permissionId,
        decision: decision === 'deny' || decision === 'cancel' ? 'reject' : 'approve',
      })
      return outcome.kind === 'accepted' ? { ok: true } : failed(outcome)
    },
    async decideQuestion() {
      return { error: 'stale-question' }
    },
  }
}
