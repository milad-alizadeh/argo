// A Project's Connection and the Tickets read through it. A Connection is validated against its
// Account when it is made, the one moment a wrong Account and a missing repository or team can be
// told apart (ADR-0018). Every read goes through the Account's token, renewed where it lapses.
import { type AccountAccess, accountState, projectNames } from '../accounts/access'
import type { AccountState } from '../accounts/contract'
import { readAccounts } from '../accounts/registry'
import { readConnections, type TicketConnection, writeConnections } from './connections'
import {
  type ConnectionState,
  type ConnectionSummary,
  type TicketConnectedReply,
  type TicketDiscoverReply,
  type TicketListReply,
  type TicketUpdateReply,
  ticketError,
} from './contract'
import { type Call, readAs } from './read-as'

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

async function findConnection(call: Call) {
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
  const found = await findConnection(call)
  if (!found.ok) return found.error
  if (!found.connection) return ticketError('not-connected', requestId)
  const { accountId, scope } = found.connection
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
  const found = await findConnection(call)
  if (!found.ok) return found.error
  if (!found.connection) return ticketError('not-connected', requestId)
  const { accountId, scope } = found.connection
  const written = await readAs(call, accountId, (source, reader) =>
    source.update(reader, { scope, ...change }),
  )
  if (!written.ok) return written.error
  const { key } = change
  return { version: 1, type: 'ticket.updated', requestId, projectId, key, status: written.value }
}
