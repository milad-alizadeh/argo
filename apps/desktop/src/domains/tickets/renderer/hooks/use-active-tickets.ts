// A Project's saved active Tickets, read from SQLite by page and refetched on each change.
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  type ConnectionSummary,
  type TicketError,
  ticketError,
} from '@/domains/tickets/contract/contract'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { numberedPages } from './numbered-pages'
import type { TicketIndexedReply } from './ticket-reply'
import { searchKey } from './use-searched-tickets'
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
        void client.invalidateQueries({ queryKey: searchKey() })
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
    ...numberedPages(
      client,
      projectId,
      enabled ? (id, page) => trpcClient.ticketActive.query({ projectId: id, page }) : null,
    ),
  })
  // A scan refused as the Account also leaves the Account listing and Connection stale.
  const failed = savedRead(list.data)?.failure?.code
  useEffect(() => {
    if (projectId && failed) onRefused(client, projectId, ticketError(failed, null))
  }, [client, projectId, failed])
  return list
}

// What the saved pages of a listing say of the provider behind them, whichever listing it is.
export type SavedRead = {
  total: number
  // Whether the provider has answered: a complete active scan, or a committed search.
  complete: boolean
  refreshing: boolean
  failure: TicketError | null
}

export function savedRead(pages: TicketPages | undefined): SavedRead | null {
  const head = pages?.pages[0]
  if (head === undefined) return null
  const { total } = head
  switch (head.type) {
    case 'ticket.indexed': {
      const { sync } = head
      // Kept through a retry's scan, so the screen does not drop the failure while it retries.
      const failure = sync.failure === null ? null : ticketError(sync.failure, null)
      return { total, complete: sync.complete, refreshing: sync.phase === 'syncing', failure }
    }
    case 'ticket.searched': {
      const { search } = head
      return {
        total,
        complete: search.completedAt !== null,
        refreshing: search.phase === 'syncing',
        failure: search.failure === null ? null : ticketError(search.failure, null),
      }
    }
    default:
      return head satisfies never
  }
}
