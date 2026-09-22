import { z } from 'zod'
import type { SessionDriveAdapter } from '@/domains/sessions/contract/session-drive-adapter'
import type { WorkspaceSelection } from '@/domains/sessions/next/contract/session-contract'
import type { ClaudeSessionAdapter } from '@/harnesses/claude/agent-sdk/claude-session-adapter'

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

function failed(): { error: 'not-drivable' } {
  return { error: 'not-drivable' }
}

function outcomeFor(outcome: { kind: string }) {
  return outcome.kind === 'accepted' ? { ok: true as const } : failed()
}

async function driveTurn(attachments: unknown[], run: () => ReturnType<typeof resumeTurn>) {
  if (attachments.length > 0) return failed()
  return outcomeFor(await run())
}

async function resumeTurn(options: {
  adapter: Pick<ClaudeSessionAdapter, 'resume'>
  workspaceForCwd: (cwd: string) => Promise<WorkspaceSelection>
  sessionId: string
  cwd: string
  prompt: string
}) {
  const workspace = await options
    .workspaceForCwd(options.cwd)
    .catch(() => ({ kind: 'main' as const }))
  return options.adapter.resume({
    session: identity(options.sessionId),
    workspace,
    prompt: options.prompt,
    cwd: options.cwd,
  })
}

export function createClaudeSdkDriveAdapter(options: {
  adapter: Pick<ClaudeSessionAdapter, 'execute' | 'projection' | 'resume'>
  workspaceForCwd: (cwd: string) => Promise<WorkspaceSelection>
}): SessionDriveAdapter {
  return {
    harness: 'claude',
    failureMessage: (code) => FAILURE_MESSAGES[code],
    turnSetupSchema: ignoredSetupSchema,
    async start({ cwd, attachments }) {
      if (attachments.length > 0) return { error: 'launch-failed' }
      const outcome = await options.adapter.execute({
        type: 'session.start',
        harness: 'claude',
        prompt: '',
        workspace: await options.workspaceForCwd(cwd),
      })
      return outcome.kind === 'accepted'
        ? { sessionId: outcome.projection.session.nativeId }
        : failed()
    },
    async send({ sessionId, cwd, prompt, attachments }) {
      return driveTurn(attachments, () => resumeTurn({ ...options, sessionId, cwd, prompt }))
    },
    async steer({ sessionId, cwd, prompt, attachments }) {
      return driveTurn(attachments, () => resumeTurn({ ...options, sessionId, cwd, prompt }))
    },
    async interrupt({ sessionId }) {
      const outcome = await options.adapter.execute({
        type: 'session.interrupt',
        session: identity(sessionId),
      })
      return outcome.kind === 'accepted' ? { ok: true } : failed()
    },
    async compact({ sessionId }) {
      const outcome = await options.adapter.execute({
        type: 'session.compact',
        session: identity(sessionId),
      })
      return outcome.kind === 'accepted' ? { ok: true } : failed()
    },
    async handoff() {
      return { error: 'not-drivable' }
    },
    async readPermission({ sessionId }) {
      const approval = options.adapter.projection(identity(sessionId))?.pendingApprovals[0]
      return {
        permission:
          approval === undefined
            ? null
            : { id: approval.id, sessionId, description: approval.summary },
      }
    },
    async decidePermission({ sessionId, permissionId, decision }) {
      const outcome = await options.adapter.execute({
        type: 'session.decide',
        session: identity(sessionId),
        approvalId: permissionId,
        decision: decision === 'deny' || decision === 'cancel' ? 'reject' : 'approve',
      })
      return outcome.kind === 'accepted' ? { ok: true } : failed()
    },
    async decideQuestion() {
      return { error: 'stale-question' }
    },
  }
}
