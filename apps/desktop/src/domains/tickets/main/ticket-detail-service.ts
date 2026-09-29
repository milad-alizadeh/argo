// One Ticket opened by reference: read from SQLite, and read by ID from the provider into SQLite.
import { z } from 'zod'
import { ticketError, ticketErrorSchema } from '@/domains/tickets/api/messages'
import { ticket, ticketStatus } from '@/domains/tickets/api/ticket'
import { identifier, message } from '@/shared/messages'
import { writableConnection } from './api/ticket-connection'
import { readSavedTicket } from './database/ticket-queries'
import { saveReadTicket } from './database/ticket-upsert'
import { type Call, readAs } from './read-as'

// An Argo UUID, a provider's native ID, or a key such as `#607` or `ENG-12`.
export const ticketReference = z.string().min(1).max(128)

// The saved Ticket, or null while none is saved under the reference.
export const ticketDetailOutputSchema = z.union([
  message('ticket.detail', {
    projectId: identifier,
    scope: identifier,
    argoId: z.uuid().nullable(),
    ticket: ticket.nullable(),
    statuses: z.array(ticketStatus),
  }),
  ticketErrorSchema,
])
// Sent only after the provider's answer is committed, so a refetch reads it.
export const ticketOpenedOutputSchema = z.union([
  message('ticket.opened', { projectId: identifier, argoId: z.uuid() }),
  ticketErrorSchema,
])

export async function readDetail(
  call: Call,
  reference: string,
): Promise<z.infer<typeof ticketDetailOutputSchema>> {
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { provider, scope } = target
  const read = readSavedTicket(call.index.database, { provider, scope, reference })
  const { requestId, projectId } = call
  return {
    version: 1,
    type: 'ticket.detail',
    requestId,
    projectId,
    scope,
    argoId: read.saved?.argoId ?? null,
    ticket: read.saved?.ticket ?? null,
    statuses: read.statuses,
  }
}

// A saved Ticket is read by its native ID; any other reference is the provider's to resolve.
export async function openTicket(
  call: Call,
  reference: string,
): Promise<z.infer<typeof ticketOpenedOutputSchema>> {
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { provider, scope, accountId } = target
  const { database, changes } = call.index
  const id = readSavedTicket(database, { provider, scope, reference }).saved?.nativeId ?? reference
  const readAt = Date.now()
  const read = await readAs(call, accountId, (source, reader) => source.read(reader, { scope, id }))
  // A reference the reader typed may never have existed, so a deletion is not claimed here.
  if (!read.ok) {
    return read.error.code === 'ticket-deleted'
      ? ticketError('ticket-not-found', call.requestId)
      : read.error
  }
  let argoId: string
  try {
    argoId = saveReadTicket(database, { provider, scope, readAt }, read.value)
  } catch (error) {
    console.warn('A Ticket read by ID could not be saved.', error)
    return ticketError('storage-not-written', call.requestId)
  }
  changes.changed({ provider, scope })
  const { requestId, projectId } = call
  return { version: 1, type: 'ticket.opened', requestId, projectId, argoId }
}
