// Account and Ticket reads on the one Query cache (`app-query-provider.tsx`). A query settles a
// contract reply: its data is the success, and its error is the channel's own error, code and table text intact.
import type { AccountError } from '@/domains/accounts/contract/contract'
import type { ProjectError } from '@/domains/projects/contract/contract'
import type { TicketError } from '@/domains/tickets/contract/contract'

// Each query names it as its error type: the Session queries on the same cache throw their own.
export type ContractFailure = AccountError | ProjectError | TicketError

export const QUERY_KEYS = { accounts: ['accounts'], tickets: ['tickets'] } as const

const isFailure = (reply: { type: string }): reply is ContractFailure =>
  reply.type === 'account.error' || reply.type === 'project.error' || reply.type === 'ticket.error'

// The clients never reject (`createDomainClient`), so a thrown value is always a contract error.
export async function settle<Success extends { type: string }>(
  pending: Promise<Success | ContractFailure>,
): Promise<Success> {
  const reply = await pending
  if (isFailure(reply)) throw reply
  return reply
}
