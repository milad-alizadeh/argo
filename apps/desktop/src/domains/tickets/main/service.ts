import { projectNames } from '@/domains/accounts/main'
import type { TicketConnection } from '@/domains/connections/main'
import {
  type TicketConnectedReply,
  type TicketDiscoverReply,
  type TicketError,
  type TicketListReply,
  type TicketUpdateReply,
  ticketError,
} from '@/domains/tickets/contract/contract'
import { connectionSummary } from './connection-summary'
import { type Call, readAs } from './read-as'

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

export async function writeTicketField<Value>(
  call: Call,
  read: (
    accountId: string,
    scope: string,
  ) => Promise<{ ok: true; value: Value } | { ok: false; error: TicketError }>,
): Promise<{ ok: true; value: Value } | { ok: false; error: TicketError }> {
  const target = await writableConnection(call)
  if (!target.ok) return target
  return read(target.accountId, target.scope)
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

export async function listTickets(
  call: Call,
  request: { query: string; cursor: string | null },
): Promise<TicketListReply> {
  const { requestId, projectId } = call
  const target = await writableConnection(call)
  if (!target.ok) return target.error
  const { accountId, scope } = target
  const page = await readAs(call, accountId, (source, reader) =>
    source.page(reader, { scope, ...request }),
  )
  if (!page.ok) return page.error
  return { version: 1, type: 'ticket.listed', requestId, projectId, scope, ...page.value }
}

export async function discoverSources(call: Call, accountId: string): Promise<TicketDiscoverReply> {
  const { requestId, projectId } = call
  const read = await readAs(call, accountId, (source, reader) => source.discover(reader))
  if (!read.ok) return read.error
  return { version: 1, type: 'ticket.discovered', requestId, projectId, scopes: read.value }
}

export async function updateStatus(
  call: Call,
  change: { key: string; statusId: string },
): Promise<TicketUpdateReply> {
  const { requestId, projectId } = call
  const written = await writeTicketField(call, (accountId, scope) =>
    readAs(call, accountId, (source, reader) => source.update(reader, { scope, ...change })),
  )
  if (!written.ok) return written.error
  const { key } = change
  return { version: 1, type: 'ticket.updated', requestId, projectId, key, status: written.value }
}
