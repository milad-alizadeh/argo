import type { ActorRefFrom, SnapshotFrom } from 'xstate'
import type {
  Approval,
  Question,
  SessionProjection,
  SessionStatus,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { createManagedSessionMachine } from '../supervision/managed-session-machine'
import { CodexSessionDriverError } from './codex-session-error'

export type ManagedSessionActor = ActorRefFrom<ReturnType<typeof createManagedSessionMachine>>
export type ManagedSessionSnapshot = SnapshotFrom<ManagedSessionActor>

function statusFrom(snapshot: ManagedSessionSnapshot): SessionStatus {
  if (
    snapshot.matches({ Active: 'AwaitingPermission' }) ||
    snapshot.matches({ Active: 'Deciding' })
  )
    return 'awaitingApproval'
  if (snapshot.matches({ Active: 'AwaitingQuestion' }) || snapshot.matches({ Active: 'Answering' }))
    return 'awaitingAnswer'
  if (snapshot.matches({ Active: 'Idle' })) return 'idle'
  if (snapshot.matches('Active')) return 'running'
  return 'idle'
}

function approvalsFrom(context: ManagedSessionSnapshot['context']): Approval[] {
  if (context.pendingApproval === null) return []
  return [
    {
      id: context.pendingApproval.id,
      turnId: context.turnId ?? context.pendingApproval.id,
      toolCallId: null,
      summary: context.pendingApproval.description,
    },
  ]
}

function questionsFrom(context: ManagedSessionSnapshot['context']): Question[] {
  if (context.pendingQuestion === null) return []
  return [
    {
      id: context.pendingQuestion.itemId,
      turnId: context.pendingQuestion.turnId,
      prompt: context.pendingQuestion.questions[0]?.question ?? '',
    },
  ]
}

export function projectionFrom(
  snapshot: ManagedSessionSnapshot,
  revision: number,
): SessionProjection {
  const { context } = snapshot
  if (context.sessionId === null) throw new CodexSessionDriverError('missing-session')
  return {
    session: context.sessionId,
    posture: snapshot.matches('Watched') ? 'watched' : 'managed',
    sourceHealth:
      snapshot.matches('Recovering') ||
      snapshot.matches('Failed') ||
      context.lastSendOutcome === 'rejected' ||
      context.turns.at(-1)?.status === 'failed'
        ? 'unavailable'
        : 'ready',
    revision,
    workspace: { id: context.workspaceId },
    status: statusFrom(snapshot),
    title: context.title,
    turns: context.turns,
    messages: context.messages,
    toolCalls: context.toolCalls,
    pendingApprovals: approvalsFrom(context),
    pendingQuestions: questionsFrom(context),
    usage: context.usage,
  }
}
