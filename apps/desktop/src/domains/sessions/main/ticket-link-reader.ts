// Reply-building for the two Session → Ticket drive operations, pulled out of reader.ts to keep
// that file under the line cap. The link write and the reply are the whole of it: a rename, if
// any, is the renderer's own separate call through `session.rename` (issue #2134).

import {
  type SessionTicketConnectRequest,
  type SessionTicketDisconnectRequest,
  sessionAcceptedSchema,
} from '@/domains/sessions/contract/contract'
import type { SessionTicketLinkStore } from '@/domains/tickets/main/session-links'

function accepted(request: { requestId: string; sessionId: string }) {
  return sessionAcceptedSchema.parse({
    version: 1,
    type: 'session.accepted',
    requestId: request.requestId,
    sessionId: request.sessionId,
  })
}

export async function connectTicketReply(
  store: SessionTicketLinkStore,
  request: SessionTicketConnectRequest,
) {
  await store.connect(
    request.sessionId,
    {
      projectId: request.projectId,
      key: request.key,
      title: request.title,
      state: request.state,
    },
    new Date().toISOString(),
  )
  return accepted(request)
}

export async function disconnectTicketReply(
  store: SessionTicketLinkStore,
  request: SessionTicketDisconnectRequest,
) {
  await store.disconnect(request.sessionId)
  return accepted(request)
}
