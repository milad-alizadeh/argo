import type { TicketScopeTarget } from '@/database/ticket/validation'
import { projectNames } from '@/domains/accounts/main'
import type { ConnectionPort, TicketConnection } from '@/domains/connections/main'
import { type TicketErrorCode, ticketError } from '@/domains/tickets/api/errors'
import { connectionSummary } from '../connection-summary'
import type { Call } from '../read-as'

type ConnectionState = Awaited<ReturnType<typeof connectionSummary>>['state']

// What each Connection state that cannot call the provider answers a write with.
const ACCOUNT_REFUSALS: Record<ConnectionState, TicketErrorCode | null> = {
  ready: null,
  'account-missing': 'missing-account',
  'account-expired': 'account-expired',
  'account-revoked': 'account-revoked',
  'account-unreadable': 'grant-unreadable',
}

const STORAGE_ERRORS = { unreadable: 'storage-unavailable', invalid: 'storage-invalid' } as const

export async function connected(call: Call, connection: TicketConnection | undefined) {
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

// The provider scope a Project's Tickets are saved under; null when no Connection can be read.
export async function projectTicketScope(
  connections: ConnectionPort,
  projectId: string,
): Promise<TicketScopeTarget | null> {
  const read = await connections.read()
  if (!read.ok) return null
  const found = read.document.connections.find((entry) => entry.projectId === projectId)
  return found === undefined ? null : { provider: found.provider, scope: found.scope }
}

export async function writableConnection(call: Call) {
  const found = await findConnection(call)
  if (!found.ok) return { ok: false, error: found.error } as const
  if (!found.connection) {
    return { ok: false, error: ticketError('not-connected', call.requestId) } as const
  }
  return { ok: true, ...found.connection } as const
}

// The Connection a write goes through; a failed Account is refused before an intent is saved.
export async function writableTarget(call: Call) {
  const target = await writableConnection(call)
  if (!target.ok) return target
  const code = ACCOUNT_REFUSALS[(await connectionSummary(call.access, target)).state]
  return code ? ({ ok: false, error: ticketError(code, call.requestId) } as const) : target
}

export async function saveConnection(call: Call, next: TicketConnection | null) {
  const saved = await call.connections.replaceTicket(call.projectId, next)
  if (typeof saved !== 'boolean' && !saved.ok) {
    return ticketError(STORAGE_ERRORS[saved.reason], call.requestId)
  }
  if (!saved) return ticketError('storage-not-written', call.requestId)
  return connected(call, next ?? undefined)
}
