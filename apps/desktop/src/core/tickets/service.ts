// A Project's Binding and the Tickets read through it. A Binding is validated against its Account
// when it is made, the one moment a wrong Account and a missing repository can be told apart
// (ADR-0018).
import type { GitHubFailure } from '../../providers/github/http'
import { readOpenTickets } from '../../providers/github/issues'
import { checkRepository, isRepositoryScope } from '../../providers/github/repository'
import {
  type AccountAccess,
  accountState,
  markRevoked,
  projectNames,
  type TokenRead,
  tokenFor,
} from '../accounts/access'
import { readAccounts } from '../accounts/registry'
import { readBindings, type TicketBinding, writeBindings } from './bindings'
import {
  type BindingSummary,
  type TicketBoundReply,
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

// GitHub refusing the token is an Account fact, recorded before the Binding reports it.
async function refused(call: Call, sent: Sent, failure: GitHubFailure | 'issues-disabled') {
  if (failure === 'unauthorized') await markRevoked(call.access, sent.accountId, sent.token)
  return ticketError(FAILURE_ERRORS[failure], call.requestId)
}

async function summary(access: AccountAccess, binding: TicketBinding): Promise<BindingSummary> {
  const read = await readAccounts(access.paths.accounts)
  const account = read.ok
    ? read.registry.accounts.find((candidate) => candidate.id === binding.accountId)
    : undefined
  const { accountId, scope } = binding
  if (!account) return { accountId, login: null, scope, state: 'account-missing' }
  const state = ACCOUNT_STATES[await accountState(access, account)]
  return { accountId, login: account.login, scope, state }
}

async function bound(call: Call, binding: TicketBinding | undefined): Promise<TicketBoundReply> {
  const { requestId, projectId } = call
  const value = binding ? await summary(call.access, binding) : null
  return { version: 1, type: 'ticket.bound', requestId, projectId, binding: value }
}

async function projectExists(call: Call): Promise<boolean> {
  return (await projectNames(call.access)).has(call.projectId)
}

export async function readBinding(call: Call): Promise<TicketBoundReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  const read = await readBindings(call.access.paths.bindings)
  if (!read.ok) return ticketError(STORAGE_ERRORS[read.reason], call.requestId)
  return bound(
    call,
    read.document.bindings.find((entry) => entry.projectId === call.projectId),
  )
}

// Replace this Project's Binding with `next`, or remove it when `next` is null.
function saveBinding(call: Call, next: TicketBinding | null): Promise<TicketBoundReply> {
  return call.access.exclusive(async () => {
    const read = await readBindings(call.access.paths.bindings)
    if (!read.ok) return ticketError(STORAGE_ERRORS[read.reason], call.requestId)
    const kept = read.document.bindings.filter((entry) => entry.projectId !== call.projectId)
    const bindings = next ? [...kept, next] : kept
    if (!(await writeBindings(call.access.paths.bindings, { ...read.document, bindings }))) {
      return ticketError('storage-not-written', call.requestId)
    }
    return bound(call, next ?? undefined)
  })
}

export async function bind(
  call: Call,
  target: { accountId: string; scope: string },
): Promise<TicketBoundReply> {
  if (!isRepositoryScope(target.scope)) return ticketError('invalid-scope', call.requestId)
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  const token = await tokenFor(call.access, target.accountId)
  if (!token.ok) return ticketError(TOKEN_ERRORS[token.reason], call.requestId)
  const check = await checkRepository(call.access.endpoints, token.token, target.scope)
  if (!check.ok) return refused(call, { ...target, token: token.token }, check.failure)
  // GitHub's canonical name is what is stored, so the Binding survives a person's casing.
  const { projectId } = call
  return saveBinding(call, {
    projectId,
    port: 'ticket',
    accountId: target.accountId,
    scope: check.fullName,
  })
}

export async function unbind(call: Call): Promise<TicketBoundReply> {
  if (!(await projectExists(call))) return ticketError('missing-project', call.requestId)
  return saveBinding(call, null)
}

export async function listTickets(call: Call): Promise<TicketListReply> {
  const { requestId, projectId } = call
  const read = await readBindings(call.access.paths.bindings)
  if (!read.ok) return ticketError(STORAGE_ERRORS[read.reason], requestId)
  const binding = read.document.bindings.find((entry) => entry.projectId === projectId)
  if (!binding) return ticketError('not-bound', requestId)
  const token = await tokenFor(call.access, binding.accountId)
  if (!token.ok) return ticketError(TOKEN_ERRORS[token.reason], requestId)
  const tickets = await readOpenTickets(call.access.endpoints, token.token, binding.scope)
  if (!tickets.ok) return refused(call, { ...binding, token: token.token }, tickets.failure)
  const scope = binding.scope
  return { version: 1, type: 'ticket.listed', requestId, projectId, scope, tickets: tickets.value }
}
