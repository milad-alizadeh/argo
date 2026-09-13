// A Project's Connection and the Tickets read through it. A Connection is validated against its Account
// when it is made, the one moment a wrong Account and a missing repository can be told apart
// (ADR-0018).
import type { GitHubFailure } from '../../providers/github/http'
import { readTicketPage } from '../../providers/github/issues'
import {
  checkRepository,
  isRepositoryScope,
  listRepositories,
} from '../../providers/github/repository'
import {
  type AccountAccess,
  accountState,
  markRevoked,
  projectNames,
  type TokenRead,
  tokenFor,
} from '../accounts/access'
import { readAccounts } from '../accounts/registry'
import { readConnections, type TicketConnection, writeConnections } from './connections'
import {
  type ConnectionSummary,
  type TicketConnectedReply,
  type TicketDiscoverReply,
  type TicketErrorCode,
  type TicketListReply,
  ticketError,
} from './contract'

const TOKEN_ERRORS: Record<Extract<TokenRead, { ok: false }>['reason'], TicketErrorCode> = {
  storage: 'storage-unavailable',
  'missing-account': 'missing-account',
  'account-revoked': 'account-revoked',
  'grant-unreadable': 'grant-unreadable',
}

const FAILURE_ERRORS: Record<GitHubFailure | 'issues-disabled', TicketErrorCode> = {
  unauthorized: 'account-revoked',
  forbidden: 'repository-not-visible',
  'not-found': 'repository-not-visible',
  'rate-limited': 'rate-limited',
  unreachable: 'github-unreachable',
  'issues-disabled': 'issues-disabled',
}

const STORAGE_ERRORS = { unreadable: 'storage-unavailable', invalid: 'storage-invalid' } as const

const ACCOUNT_STATES = {
  connected: 'ready',
  revoked: 'account-revoked',
  unreadable: 'account-unreadable',
} as const

type Call = { access: AccountAccess; requestId: string; projectId: string }

type Sent = { accountId: string; token: string }

// GitHub refusing the token is an Account fact, recorded before the Connection reports it.
async function refused(call: Call, sent: Sent, failure: GitHubFailure | 'issues-disabled') {
  if (failure === 'unauthorized') await markRevoked(call.access, sent.accountId, sent.token)
  return ticketError(FAILURE_ERRORS[failure], call.requestId)
}

async function summary(
  access: AccountAccess,
  connection: TicketConnection,
): Promise<ConnectionSummary> {
  const read = await readAccounts(access.paths.accounts)
  const account = read.ok
    ? read.registry.accounts.find((candidate) => candidate.id === connection.accountId)
    : undefined
  const { accountId, scope } = connection
  if (!account) return { accountId, login: null, scope, state: 'account-missing' }
  const state = ACCOUNT_STATES[await accountState(access, account)]
  return { accountId, login: account.login, scope, state }
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

export async function readConnection(call: Call): Promise<TicketConnectedReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  const read = await readConnections(call.access.paths.connections)
  if (!read.ok) return ticketError(STORAGE_ERRORS[read.reason], call.requestId)
  return connected(
    call,
    read.document.connections.find((entry) => entry.projectId === call.projectId),
  )
}

// Replace this Project's Connection with `next`, or remove it when `next` is null.
function saveConnection(call: Call, next: TicketConnection | null): Promise<TicketConnectedReply> {
  return call.access.exclusive(async () => {
    const read = await readConnections(call.access.paths.connections)
    if (!read.ok) return ticketError(STORAGE_ERRORS[read.reason], call.requestId)
    const kept = read.document.connections.filter((entry) => entry.projectId !== call.projectId)
    const connections = next ? [...kept, next] : kept
    if (
      !(await writeConnections(call.access.paths.connections, { ...read.document, connections }))
    ) {
      return ticketError('storage-not-written', call.requestId)
    }
    return connected(call, next ?? undefined)
  })
}

export async function connectRepository(
  call: Call,
  target: { accountId: string; scope: string },
): Promise<TicketConnectedReply> {
  if (!isRepositoryScope(target.scope)) return ticketError('invalid-scope', call.requestId)
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  const token = await tokenFor(call.access, target.accountId)
  if (!token.ok) return ticketError(TOKEN_ERRORS[token.reason], call.requestId)
  const check = await checkRepository(call.access.endpoints, token.token, target.scope)
  if (!check.ok) return refused(call, { ...target, token: token.token }, check.failure)
  // GitHub's canonical name is what is stored, so the Connection survives a person's casing.
  const { projectId } = call
  return saveConnection(call, {
    projectId,
    port: 'ticket',
    accountId: target.accountId,
    scope: check.fullName,
  })
}

export async function disconnectRepository(call: Call): Promise<TicketConnectedReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  return saveConnection(call, null)
}

export async function listTickets(
  call: Call,
  request: { query: string; page: number },
): Promise<TicketListReply> {
  const { requestId, projectId } = call
  const read = await readConnections(call.access.paths.connections)
  if (!read.ok) return ticketError(STORAGE_ERRORS[read.reason], requestId)
  const connection = read.document.connections.find((entry) => entry.projectId === projectId)
  if (!connection) return ticketError('not-connected', requestId)
  const token = await tokenFor(call.access, connection.accountId)
  if (!token.ok) return ticketError(TOKEN_ERRORS[token.reason], requestId)
  const { scope } = connection
  const page = await readTicketPage(call.access.endpoints, token.token, { scope, ...request })
  if (!page.ok) return refused(call, { ...connection, token: token.token }, page.failure)
  return { version: 1, type: 'ticket.listed', requestId, projectId, scope, ...page.value }
}

export async function discoverRepositories(
  call: Call,
  accountId: string,
): Promise<TicketDiscoverReply> {
  const { requestId, projectId } = call
  const token = await tokenFor(call.access, accountId)
  if (!token.ok) return ticketError(TOKEN_ERRORS[token.reason], requestId)
  const read = await listRepositories(call.access.endpoints, token.token)
  if (!read.ok) return refused(call, { accountId, token: token.token }, read.failure)
  return { version: 1, type: 'ticket.discovered', requestId, projectId, scopes: read.value }
}
