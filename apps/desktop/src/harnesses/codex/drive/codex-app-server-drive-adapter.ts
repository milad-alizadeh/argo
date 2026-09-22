import { z } from 'zod'
import type { SessionDriveAdapter } from '@/domains/sessions/contract/session-drive-adapter'
import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'
import type { CodexSessionAdapter } from './session/codex-session-adapter-contract'
import { CodexSessionDriverError } from './session/codex-session-error'

const ignoredSetupSchema = z.unknown()
const FAILURE_MESSAGES = {
  'harness-unavailable': 'Codex is not available. Run codex doctor to repair it.',
  'launch-failed': 'Argo could not start Codex.',
  'not-drivable': 'Argo no longer holds this Codex Session.',
  'held-elsewhere': 'Another Argo window is driving this Codex Session.',
  'stale-permission': 'This Codex permission is no longer waiting.',
  'stale-question': 'This Codex question is no longer waiting.',
} as const

function identity(sessionId: string) {
  return { harness: 'codex' as const, nativeId: sessionId }
}

const FAILED = { error: 'not-drivable' as const }
const SUCCEEDED = { ok: true } as const

function hasAttachments(attachments: readonly unknown[]): boolean {
  return attachments.length > 0
}

function failureOf(error: unknown) {
  if (error instanceof CodexSessionDriverError && error.code !== 'missing-session') {
    return { error: error.code } as const
  }
  return FAILED
}

function commandOperations(
  adapter: CodexSessionAdapter,
  workspaceForCwd: (cwd: string) => Promise<WorkspaceSelection>,
) {
  return {
    async send({
      sessionId,
      cwd,
      prompt,
      attachments,
    }: Parameters<SessionDriveAdapter['send']>[0]) {
      if (hasAttachments(attachments)) return FAILED
      try {
        const outcome = await adapter.resume({
          session: identity(sessionId),
          workspace: await workspaceForCwd(cwd),
          cwd,
          prompt,
        })
        if (outcome.kind === 'accepted') return SUCCEEDED
        if (outcome.kind === 'rejected')
          return { error: 'not-drivable' as const, message: outcome.reason }
        return FAILED
      } catch (error) {
        return failureOf(error)
      }
    },
    async steer({
      sessionId,
      prompt,
      attachments,
    }: Parameters<NonNullable<SessionDriveAdapter['steer']>>[0]) {
      if (hasAttachments(attachments)) return FAILED
      const outcome = await adapter.execute({
        type: 'session.steer',
        session: identity(sessionId),
        prompt,
      })
      return outcome.kind === 'accepted' ? SUCCEEDED : FAILED
    },
    async interrupt({ sessionId }: Parameters<SessionDriveAdapter['interrupt']>[0]) {
      const outcome = await adapter.execute({
        type: 'session.interrupt',
        session: identity(sessionId),
      })
      return outcome.kind === 'accepted' ? SUCCEEDED : FAILED
    },
    async compact({ sessionId }: Parameters<SessionDriveAdapter['compact']>[0]) {
      const outcome = await adapter.execute({
        type: 'session.compact',
        session: identity(sessionId),
      })
      return outcome.kind === 'accepted' ? SUCCEEDED : FAILED
    },
    async handoff() {
      return FAILED
    },
    async readPermission() {
      return { permission: null }
    },
  }
}

function decisionOperations(adapter: CodexSessionAdapter) {
  return {
    async decidePermission({
      sessionId,
      permissionId,
      decision,
    }: Parameters<SessionDriveAdapter['decidePermission']>[0]) {
      const outcome = await adapter.execute({
        type: 'session.decide',
        session: identity(sessionId),
        approvalId: permissionId,
        decision: decision === 'deny' || decision === 'cancel' ? 'reject' : 'approve',
      })
      return outcome.kind === 'accepted' ? SUCCEEDED : FAILED
    },
    async decideQuestion({
      sessionId,
      questionId,
      answers,
    }: Parameters<SessionDriveAdapter['decideQuestion']>[0]) {
      const answer = answers
        .map((item) => (item.kind === 'text' ? item.text : item.indices.join(', ')))
        .join('\n')
      const outcome = await adapter.execute({
        type: 'session.answer',
        session: identity(sessionId),
        questionId,
        answer,
      })
      return outcome.kind === 'accepted' ? SUCCEEDED : FAILED
    },
  }
}

export function createCodexAppServerDriveAdapter(options: {
  adapter: CodexSessionAdapter
  workspaceForCwd: (cwd: string) => Promise<WorkspaceSelection>
}): SessionDriveAdapter {
  return {
    harness: 'codex',
    failureMessage: (code) => FAILURE_MESSAGES[code],
    turnSetupSchema: ignoredSetupSchema,
    async start({ cwd, prompt, attachments }) {
      if (hasAttachments(attachments)) return { error: 'launch-failed' }
      const outcome = await options.adapter.execute({
        type: 'session.start',
        harness: 'codex',
        prompt,
        workspace: await options.workspaceForCwd(cwd),
      })
      return outcome.kind === 'accepted'
        ? { sessionId: outcome.projection.session.nativeId }
        : FAILED
    },
    ...commandOperations(options.adapter, options.workspaceForCwd),
    ...decisionOperations(options.adapter),
  }
}
