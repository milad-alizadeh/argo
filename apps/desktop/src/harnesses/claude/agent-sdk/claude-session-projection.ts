import type { ActorRefFrom, SnapshotFrom } from 'xstate'
import type {
  SessionProjection,
  SessionStatus,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { createClaudeSessionMachine } from '@/harnesses/claude/agent-sdk/claude-session-actor'

export type ClaudeSessionActor = ActorRefFrom<ReturnType<typeof createClaudeSessionMachine>>
export type ClaudeSessionSnapshot = SnapshotFrom<ClaudeSessionActor>

function statusFrom(snapshot: ClaudeSessionSnapshot): SessionStatus {
  if (snapshot.matches('Managed')) return 'idle'
  return 'idle'
}

export function projectionFrom(
  snapshot: ClaudeSessionSnapshot,
  revision: number,
): SessionProjection {
  const { context } = snapshot
  if (context.session === null) throw new Error('Claude Session has no identity')
  return {
    session: context.session,
    posture: snapshot.matches('Watched') ? 'watched' : 'managed',
    sourceHealth: context.sourceHealth,
    revision,
    workspace: { id: context.workspaceId },
    status: statusFrom(snapshot),
    title: null,
    turns: [],
    messages: [],
    toolCalls: [],
    pendingApprovals: [],
    pendingQuestions: [],
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}
