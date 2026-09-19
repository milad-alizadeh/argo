// A Project's Connection and the Tickets read through it. A Connection is validated against its
// Account when it is made, the one moment a wrong Account and a missing repository or team can be
// told apart (ADR-0018). Every read goes through the Account's token, renewed where it lapses.

import type { AccountState } from '@/domains/accounts/contract/contract'
import { type AccountAccess, accountState, projectNames } from '@/domains/accounts/main/access'
import { readAccounts } from '@/domains/accounts/main/registry'
import {
  type ConnectionState,
  type ConnectionSummary,
  type TicketConnectedReply,
  type TicketDiscoverReply,
  type TicketError,
  type TicketListReply,
  type TicketUpdateReply,
  ticketError,
} from '@/domains/tickets/contract/contract'
import {
  readConnections,
  type TicketConnection,
  writeConnections,
} from '@/domains/tickets/main/connections'
import { type Call, readAs } from '@/domains/tickets/main/read-as'

const STORAGE_ERRORS = { unreadable: 'storage-unavailable', invalid: 'storage-invalid' } as const

const ACCOUNT_STATES: Record<AccountState, ConnectionState> = {
  connected: 'ready',
  expired: 'account-expired',
  revoked: 'account-revoked',
  unreadable: 'account-unreadable',
}

async function summary(
  access: AccountAccess,
  connection: TicketConnection,
): Promise<ConnectionSummary> {
  const read = await readAccounts(access.paths.accounts)
  const account = read.ok
    ? read.registry.accounts.find((candidate) => candidate.id === connection.accountId)
    : undefined
  const { accountId, provider, scope, label } = connection
  const known = { accountId, provider, scope, label }
  if (!account) return { ...known, login: null, state: 'account-missing' }
  return {
    ...known,
    login: account.login,
    state: ACCOUNT_STATES[await accountState(access, account)],
  }
}

async function connected(
  call: Call,
  connection: TicketConnection | undefined,
): Promise<TicketConnectedReply> {
  const { requestId, projectId } = call
  const value = connection ? await summary(call.access, connection) : null
  return { version: 1, type: 'ticket.connected', requestId, projectId, connection: value }
}

async function projectExists(call: Call): Promise<boolean> {
  return (await projectNames(call.access)).has(call.projectId)
}

export async function findConnection(call: Call) {
  const read = await readConnections(call.access.paths.connections)
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

// The Connection a write goes through: its Account and scope, or why there is none to write with.
export async function writableConnection(call: Call) {
  const found = await findConnection(call)
  if (!found.ok) return { ok: false, error: found.error } as const
  if (!found.connection) {
    return { ok: false, error: ticketError('not-connected', call.requestId) } as const
  }
  return { ok: true, ...found.connection } as const
}

// Every field a Ticket can be moved to resolves the write's Account and scope the same way, then
// asks the source for its own field-specific write.
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

// Replace this Project's Connection with `next`, or remove it when `next` is null.
function saveConnection(call: Call, next: TicketConnection | null): Promise<TicketConnectedReply> {
  return call.access.exclusive(async () => {
    const read = await readConnections(call.access.paths.connections)
    if (!read.ok) return ticketError(STORAGE_ERRORS[read.reason], call.requestId)
    const kept = read.document.connections.filter((entry) => entry.projectId !== call.projectId)
    const connections = next ? [...kept, next] : kept
    const document = { ...read.document, connections }
    if (!(await writeConnections(call.access.paths.connections, document))) {
      return ticketError('storage-not-written', call.requestId)
    }
    return connected(call, next ?? undefined)
  })
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
