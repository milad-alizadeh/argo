import type * as SessionContract from '@/domains/sessions/contract/ipc/contract'
import { type OwnerContext, ownedAccepted } from '@/domains/sessions/main/drive/drive'

export function steerSession(
  request: SessionContract.SessionSteerRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  return ownedAccepted(
    context,
    request,
    async (owned) =>
      (await owned.adapter.steer?.({
        sessionId: request.sessionId,
        prompt: request.prompt,
        attachments: request.attachments ?? [],
      })) ?? { error: 'not-drivable' as const },
  )
}
