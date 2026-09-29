import { projectNames } from '@/domains/accounts/main'
import type { TicketConnection } from '@/domains/connections/main'
import {
  type TicketConnectedReply,
  type TicketDiscoverReply,
  type TicketListReply,
  type TicketPriorityReply,
  type TicketUpdateReply,
  ticketError,
} from '@/domains/tickets/contract/contract'
import type { PriorityChange } from '@/domains/tickets/contract/ticket'
import { connectionSummary } from '../connection-summary'
import { type Call, readAs } from '../read-as'

const STORAGE_ERRORS = { unreadable: 'storage-unavailable', invalid: 'storage-invalid' } as const

async function connected(
  call: Call,
  connection: TicketConnection | undefined,
): Promise<TicketConnectedReply> {
  const { requestId, projectId } = call
  const value = connection ? await connectionSummary(call.access, connection) : null
  return { version: 1, type: 'ticket.connected', requestId, projectId, connection: value }
}

async function projectExists(call: Call): Promise<boolean> {
  return (await projectNames(call.access)).has(call.projectId)
}

export async function findConnection(call: Call) {
  const read = await call.connections.read()
  if (!read.ok)
    return { ok: false, error: ticketError(STORAGE_ERRORS[read.reason], call.requestId) } as const
  const found = read.document.connections.find((entry) => entry.projectId === call.projectId)
  return { ok: true, connection: found } as const
}

export async function readConnection(call: Call): Promise<TicketConnectedReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  const found = await findConnection(call)
  return found.ok ? connected(call, found.connection) : found.error
}

export async function writableConnection(call: Call) {
  const found = await findConnection(call)
  if (!found.ok) return { ok: false, error: found.error } as const
  if (!found.connection) {
    return { ok: false, error: ticketError('not-connected', call.requestId) } as const
  }
  return { ok: true, ...found.connection } as const
}

async function saveConnection(
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

export async function connectSource(
  call: Call,
  target: { accountId: string; scope: string },
): Promise<TicketConnectedReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  const check = await readAs(call, target.accountId, (source, reader) =>
    source.check(reader, target.scope),
  )
  if (!check.ok) return check.error
  const { scope, label } = check.value
  const { projectId } = call
  const { accountId } = target
  const { provider } = check
  return saveConnection(call, { projectId, port: 'ticket', provider, accountId, scope, label })
}

export async function disconnectSource(call: Call): Promise<TicketConnectedReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  return saveConnection(call, null)
}

export async function discoverSources(call: Call, accountId: string): Promise<TicketDiscoverReply> {
  const { requestId, projectId } = call
  const read = await readAs(call, accountId, (source, reader) => source.discover(reader))
  if (!read.ok) return read.error
  return { version: 1, type: 'ticket.discovered', requestId, projectId, scopes: read.value }
}

export async function listTickets(
  call: Call,
  request: { query: string; cursor: string | null },
): Promise<TicketListReply> {
  const { requestId, projectId } = call
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { accountId, scope } = target
  const read = await readAs(call, accountId, (source, reader) =>
    source.page(reader, { scope, ...request }),
  )
  if (!read.ok) return read.error
  return {
    version: 1,
    type: 'ticket.listed',
    requestId,
    projectId,
    scope,
    ...read.value,
  }
}

// The change is committed by the operation supervisor; the reply announces only what it committed.
export async function updateStatus(
  call: Call,
  change: { key: string; statusId: string },
): Promise<TicketUpdateReply> {
  const { requestId, projectId } = call
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { accountId, provider, scope } = target
  const outcome = await call.index.changeStatus({
    provider,
    scope,
    accountId,
    operation: 'status',
    ...change,
  })
  if (outcome.type !== 'committed' || outcome.confirmed.operation !== 'status') {
    return ticketError(
      outcome.type === 'committed' ? 'invalid-response' : outcome.failure,
      requestId,
    )
  }
  const { key } = change
  const { status } = outcome.confirmed
  return { version: 1, type: 'ticket.updated', requestId, projectId, key, status }
}

// The same path as a status change: the priority in the reply is the one the provider confirmed.
export async function updatePriority(
  call: Call,
  change: Omit<PriorityChange, 'scope'>,
): Promise<TicketPriorityReply> {
  const { requestId, projectId } = call
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { accountId, provider, scope } = target
  const { priorityChoices } = call.providers[provider].tickets
  if (
    change.priorityLevel !== null &&
    !priorityChoices.some(({ level }) => level === change.priorityLevel)
  ) {
    return ticketError('ticket-not-writable', requestId)
  }
  const outcome = await call.index.changePriority({
    provider,
    scope,
    accountId,
    operation: 'priority',
    ...change,
  })
  if (outcome.type !== 'committed' || outcome.confirmed.operation !== 'priority') {
    return ticketError(
      outcome.type === 'committed' ? 'invalid-response' : outcome.failure,
      requestId,
    )
  }
  const { key } = change
  const { priority } = outcome.confirmed
  return { version: 1, type: 'ticket.prioritized', requestId, projectId, key, priority }
}
