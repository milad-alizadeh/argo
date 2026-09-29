import { projectNames } from '@/domains/accounts/main'
import type { TicketConnection } from '@/domains/connections/main'
import { type TicketConnectedReply, ticketError } from '@/domains/tickets/contract/contract'
import { connectionSummary } from '../connection-summary'
import type { Call } from '../read-as'

const STORAGE_ERRORS = { unreadable: 'storage-unavailable', invalid: 'storage-invalid' } as const

export async function connected(
  call: Call,
  connection: TicketConnection | undefined,
): Promise<TicketConnectedReply> {
  const { requestId, projectId } = call
  const value = connection ? await connectionSummary(call.access, connection) : null
  return { version: 1, type: 'ticket.connected', requestId, projectId, connection: value }
}

export async function projectExists(call: Call): Promise<boolean> {
  return (await projectNames(call.access)).has(call.projectId)
}

export async function findConnection(call: Call) {
  const read = await call.connections.read()
  if (!read.ok)
    return { ok: false, error: ticketError(STORAGE_ERRORS[read.reason], call.requestId) } as const
  const found = read.document.connections.find((entry) => entry.projectId === call.projectId)
  return { ok: true, connection: found } as const
}

export async function writableConnection(call: Call) {
  const found = await findConnection(call)
  if (!found.ok) return { ok: false, error: found.error } as const
  if (!found.connection) {
    return { ok: false, error: ticketError('not-connected', call.requestId) } as const
  }
  return { ok: true, ...found.connection } as const
}

export async function saveConnection(
  call: Call,
  next: TicketConnection | null,
): Promise<TicketConnectedReply> {
  const saved = await call.connections.replaceTicket(call.projectId, next)
  if (typeof saved !== 'boolean' && !saved.ok) {
    return ticketError(STORAGE_ERRORS[saved.reason], call.requestId)
  }
  if (!saved) return ticketError('storage-not-written', call.requestId)
  return connected(call, next ?? undefined)
}
