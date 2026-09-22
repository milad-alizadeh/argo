import type * as SessionContract from '@/domains/sessions/contract/ipc'
import { sessionError } from '@/domains/sessions/contract/ipc'
import { type OwnerContext, ownedAccepted } from './drive'

export async function readSessionPermission(
  request: SessionContract.SessionPermissionRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionPermissionReply> {
  const owned = await context.ownerHarnessFor(request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  const adapter = context.adapters[owned]
  if (adapter === undefined) return sessionError('missing-session', request.requestId)
  const { permission } = await adapter.readPermission({ sessionId: request.sessionId })
  return {
    version: 1,
    type: 'session.permission.read',
    requestId: request.requestId,
    sessionId: request.sessionId,
    permission,
  }
}

export function decideSessionPermission(
  request: SessionContract.SessionPermissionDecisionRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  return ownedAccepted(context, request, (owned) =>
    owned.adapter.decidePermission({
      sessionId: request.sessionId,
      permissionId: request.permissionId,
      decision: request.decision,
    }),
  )
}

export function decideSessionQuestion(
  request: SessionContract.SessionQuestionDecisionRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  return ownedAccepted(context, request, (owned) =>
    owned.adapter.decideQuestion({
      sessionId: request.sessionId,
      questionId: request.questionId,
      answers: request.answers,
    }),
  )
}
