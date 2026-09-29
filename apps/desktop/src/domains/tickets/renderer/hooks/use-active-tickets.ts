// A Project's saved active Tickets, read from SQLite by page and refetched on each change.
import { skipToken, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  type ConnectionSummary,
  type TicketError,
  ticketError,
} from '@/domains/tickets/contract/contract'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { type TicketIndexed, type TicketIndexedReply, ticketReply } from './ticket-reply'
import { detailKey } from './use-ticket-detail'
import { listKey, onRefused, type TicketPages } from './use-tickets'

const activeKey = () => [...listKey(), 'active']

// Every committed Ticket change refetches the saved pages and Ticket on screen, never a provider.
export function useTicketChanges() {
  const client = useQueryClient()
  useEffect(() => {
    const subscription = trpcClient.ticketChanges.subscribe(undefined, {
      onData: () => {
        void client.invalidateQueries({ queryKey: activeKey() })
        void client.invalidateQueries({ queryKey: detailKey() })
      },
    })
    return () => subscription.unsubscribe()
  }, [client])
}

// While the screen shows a readable Connection, main scans it on open, on a Project or source
// change, when the Account is readable again, when the window returns, and on its poll.
export function useTicketSync(projectId: string | null, connection: ConnectionSummary | null) {
  const sync = useMutation({
    mutationFn: (id: string) => trpcClient.ticketSync.mutate({ projectId: id }),
  })
  const { mutate } = sync
  const ready = connection?.state === 'ready'
  const scope = connection?.scope
  const accountId = connection?.accountId
  useEffect(() => {
    if (projectId === null || !ready || scope === undefined || accountId === undefined) return
    const watch = trpcClient.ticketWatch.subscribe({ projectId }, {})
    return () => watch.unsubscribe()
  }, [projectId, ready, scope, accountId])
  return () => {
    if (projectId !== null) mutate(projectId)
  }
}

export function useActiveTickets(projectId: string | null, enabled: boolean) {
  const client = useQueryClient()
  const list = useInfiniteQuery<
    TicketIndexedReply,
    ContractFailure,
    TicketPages,
    unknown[],
    number
  >({
    queryKey: [...activeKey(), projectId],
    queryFn:
      enabled && projectId
        ? ({ pageParam }) =>
            trpcClient.ticketActive
              .query({ projectId, page: pageParam })
              .then(ticketReply)
              .catch((failure: ContractFailure) => {
                onRefused(client, projectId, failure)
                throw failure
              })
        : skipToken,
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const read = ticketReply(last)
      return (read.page + 1) * read.pageSize < read.total ? read.page + 1 : undefined
    },
  })
  // A scan refused as the Account also leaves the Account listing and Connection stale.
  const failed = syncFailure(list.data)?.code
  useEffect(() => {
    if (projectId && failed) onRefused(client, projectId, ticketError(failed, null))
  }, [client, projectId, failed])
  return list
}

// The saved pages of an active listing, when the listing is one.
export function indexedHead(pages: TicketPages | undefined): TicketIndexed | null {
  const head = pages?.pages[0]
  return head?.type === 'ticket.indexed' ? head : null
}

// The last scan's failure, kept while a retry runs, as the Ticket error the screen draws.
export function syncFailure(pages: TicketPages | undefined): TicketError | null {
  const failure = indexedHead(pages)?.sync.failure ?? null
  return failure === null ? null : ticketError(failure, null)
}
