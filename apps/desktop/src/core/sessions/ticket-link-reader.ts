// Reply-building for the two Session → Ticket drive operations, pulled out of reader.ts to keep
// that file under the line cap. The link write and the reply are the whole of it: a rename, if
// any, is the renderer's own separate call through `session.rename` (issue #2134).
import type { SessionTicketLinkStore } from '../tickets/session-links'
import {
  sessionAcceptedSchema,
  sessionError,
  sessionTicketConnectRequestSchema,
  sessionTicketDisconnectRequestSchema,
} from './contract'
import { versionFailure } from './read-request'

export async function connectTicketReply(store: SessionTicketLinkStore, request: unknown) {
  if (versionFailure(request)) return sessionError('unsupported-version', null)
  const parsed = sessionTicketConnectRequestSchema.safeParse(request)
  if (!parsed.success) return sessionError('invalid-request', null)
  await store.connect(
    parsed.data.sessionId,
    {
      projectId: parsed.data.projectId,
      key: parsed.data.key,
      title: parsed.data.title,
      state: parsed.data.state,
    },
    new Date().toISOString(),
  )
  return sessionAcceptedSchema.parse({
    version: 1,
    type: 'session.accepted',
    requestId: parsed.data.requestId,
    sessionId: parsed.data.sessionId,
  })
}

export async function disconnectTicketReply(store: SessionTicketLinkStore, request: unknown) {
  if (versionFailure(request)) return sessionError('unsupported-version', null)
  const parsed = sessionTicketDisconnectRequestSchema.safeParse(request)
  if (!parsed.success) return sessionError('invalid-request', null)
  await store.disconnect(parsed.data.sessionId)
  return sessionAcceptedSchema.parse({
    version: 1,
    type: 'session.accepted',
    requestId: parsed.data.requestId,
    sessionId: parsed.data.sessionId,
  })
}
