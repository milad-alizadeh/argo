// The Session → Ticket link IPC contract: a reader asserts or drops the one Ticket a Session
// links to (CONTEXT.md L1 · Session → Ticket, ADR-0017). The roster row's own `ticket` field is
// how a caller reads the link back; these two operations are only how it changes.
import { z } from 'zod'
import { ticketKey } from '@/domains/tickets/contract/ticket'
import { identifierSchema } from '@/shared/validation'

export const sessionTicketConnectRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.ticket.connect'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  projectId: identifierSchema,
  key: ticketKey,
  title: z.string(),
  state: z.enum(['open', 'closed']),
})
export type SessionTicketConnectRequest = z.infer<typeof sessionTicketConnectRequestSchema>

export const sessionTicketDisconnectRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.ticket.disconnect'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionTicketDisconnectRequest = z.infer<typeof sessionTicketDisconnectRequestSchema>
