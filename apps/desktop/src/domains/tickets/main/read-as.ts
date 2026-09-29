// A Ticket source read as an Account: the token found, renewed where it lapsed, and every way
// that fails named as the Ticket error the Connection shows.

import type { Provider } from '@/domains/accounts/contract/contract'
import { providerOf } from '@/domains/accounts/contract/provider'
import { type AccountAccess, asAccount, type TokenFailure } from '@/domains/accounts/main'
import type { ConnectionPort } from '@/domains/connections/main'
import { type TicketError, type TicketErrorCode, ticketError } from '@/domains/tickets/api/messages'
import type { Reader, SourceRead, TicketSource } from './sources'
import type { TicketIndex } from './sync/ticket-changes'

const TOKEN_ERRORS: Record<Exclude<TokenFailure['reason'], 'renewal-failed'>, TicketErrorCode> = {
  storage: 'storage-unavailable',
  'missing-account': 'missing-account',
  'account-expired': 'account-expired',
  'account-revoked': 'account-revoked',
  'grant-unreadable': 'grant-unreadable',
}

export type Call = {
  access: AccountAccess
  connections: ConnectionPort
  requestId: string
  projectId: string
  // The Ticket half of each provider's registration.
  providers: Record<Provider, { tickets: TicketSource }>
  index: TicketIndex
}

type Read<T> = { ok: true; value: T; provider: Provider } | { ok: false; error: TicketError }

// What a provider read needs from a Call: Account access, the registrations and a request ID.
export type ReadCall = Pick<Call, 'access' | 'providers' | 'requestId'>

const failure = (call: ReadCall, code: TicketErrorCode) =>
  ({ ok: false, error: ticketError(code, call.requestId) }) as const

// One source read as the Account. A refusal the renewal could not fix has already marked it.
export async function readAs<T>(
  call: ReadCall,
  accountId: string,
  read: (source: TicketSource, reader: Reader) => Promise<SourceRead<T>>,
): Promise<Read<T>> {
  const provider = providerOf(accountId)
  if (!provider) return failure(call, 'missing-account')
  const source = call.providers[provider].tickets
  const outcome = await asAccount(call.access, accountId, {
    call: (token) => read(source, { endpoints: call.access.endpoints, token }),
    refused: (reply) => !reply.ok && reply.failure === 'refused',
  })
  if (!outcome.ok) {
    const reason = outcome.reason
    return failure(
      call,
      reason === 'renewal-failed' ? source.outage[outcome.failure] : TOKEN_ERRORS[reason],
    )
  }
  const { reply } = outcome
  if (!reply.ok) {
    return failure(call, reply.failure === 'refused' ? 'account-revoked' : reply.failure)
  }
  return { ok: true, value: reply.value, provider }
}
