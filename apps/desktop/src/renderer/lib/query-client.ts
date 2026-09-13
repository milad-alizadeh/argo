// The renderer's one Query cache. A query settles a contract reply: its data is the success, and
// its error is the channel's own error, code and table text intact.
import { QueryClient } from '@tanstack/react-query'
import type { AccountError } from '@/core/accounts/contract'
import type { TicketError } from '@/core/tickets/contract'

export type ContractFailure = AccountError | TicketError

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ContractFailure
  }
}

export const QUERY_KEYS = { accounts: ['accounts'], tickets: ['tickets'] } as const

const isFailure = (reply: { type: string }): reply is ContractFailure =>
  reply.type === 'account.error' || reply.type === 'ticket.error'

// The clients never reject (`createSender`), so a thrown value is always a contract error.
export async function settle<Success extends { type: string }>(
  pending: Promise<Success | ContractFailure>,
): Promise<Success> {
  const reply = await pending
  if (isFailure(reply)) throw reply
  return reply
}

// A GitHub refusal is drawn at once rather than after three backed-off retries.
export const createQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })
