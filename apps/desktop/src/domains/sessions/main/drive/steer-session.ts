import type * as SessionContract from '@/domains/sessions/contract/ipc'
import { sessionError } from '@/domains/sessions/contract/ipc'
import { type OwnerContext, ownedAccepted } from './drive'

export async function steerSession(
  request: SessionContract.SessionSteerRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  const cwd = await context.sessionCwdFor(request.sessionId)
  if (cwd === undefined) return sessionError('missing-session', request.requestId)
  return ownedAccepted(
    context,
    request,
    async (owned) =>
      (await owned.adapter.steer?.({
        sessionId: request.sessionId,
        cwd,
        prompt: request.prompt,
        attachments: request.attachments ?? [],
      })) ?? { error: 'not-drivable' as const },
  )
}
