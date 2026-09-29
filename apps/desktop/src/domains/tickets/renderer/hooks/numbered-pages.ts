// The paging both saved listings share: a numbered page per scroll, each read refused as the Account
// turning that Account's listing and Connection stale.
import { type QueryClient, type QueryFunction, skipToken } from '@tanstack/react-query'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { type TicketIndexedReply, type TicketSearchedReply, ticketReply } from './ticket-reply'
import { onRefused } from './use-tickets'

type NumberedReply = TicketIndexedReply | TicketSearchedReply

// A refusal throws, so the query holds only the pages that were read.
function readOrThrow<Reply extends NumberedReply>(reply: Reply): Reply {
  ticketReply(reply)
  return reply
}

export function numberedPages<Reply extends NumberedReply>(
  client: QueryClient,
  projectId: string | null,
  read: ((projectId: string, page: number) => Promise<Reply>) | null,
): {
  queryFn: QueryFunction<Reply, unknown[], number> | typeof skipToken
  initialPageParam: number
  getNextPageParam: (last: Reply) => number | undefined
} {
  return {
    queryFn:
      read && projectId
        ? ({ pageParam }) =>
            read(projectId, pageParam)
              .then(readOrThrow)
              .catch((failure: ContractFailure) => {
                onRefused(client, projectId, failure)
                throw failure
              })
        : skipToken,
    initialPageParam: 0,
    getNextPageParam: (last: Reply) => {
      if (last.type === 'ticket.error') return undefined
      const { page, pageSize, total } = last
      return (page + 1) * pageSize < total ? page + 1 : undefined
    },
  }
}
