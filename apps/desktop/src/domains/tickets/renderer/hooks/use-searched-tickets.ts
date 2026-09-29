// A Project's saved Ticket matches for a query, read from SQLite by page. The provider is asked once
// per settled query, and its matches arrive as a committed change that refetches these pages.
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect } from 'react'
import { ticketError } from '@/domains/tickets/contract/contract'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { numberedPages } from './numbered-pages'
import { type TicketSearchedReply, ticketReply } from './ticket-reply'
import { listKey, onRefused, type TicketPages } from './use-tickets'

export const searchKey = () => [...listKey(), 'search']

// Asks main to search the provider for the query, now and whenever the query settles anew. A request
// refused as the Account turns the Connection and listing stale; anything else is main's to record.
export function useProviderSearch(projectId: string | null, enabled: boolean, query: string) {
  const client = useQueryClient()
  const { mutate } = useMutation({
    mutationFn: (input: { projectId: string; query: string }) =>
      trpcClient.ticketSearchProvider.mutate(input).then(ticketReply),
    onError: (failure: ContractFailure, { projectId: id }) => onRefused(client, id, failure),
  })
  useEffect(() => {
    if (enabled && projectId !== null) mutate({ projectId, query })
  }, [enabled, projectId, query, mutate])
  return () => {
    if (projectId !== null) mutate({ projectId, query })
  }
}

export function useSearchedTickets(projectId: string | null, enabled: boolean, query: string) {
  const client = useQueryClient()
  const list = useInfiniteQuery<
    TicketSearchedReply,
    ContractFailure,
    TicketPages,
    unknown[],
    number
  >({
    queryKey: [...searchKey(), projectId, query],
    ...numberedPages(
      client,
      projectId,
      enabled ? (id, page) => trpcClient.ticketSearch.query({ projectId: id, query, page }) : null,
    ),
    placeholderData: keepPreviousData,
  })
  // A search refused as the Account also leaves the Account listing and Connection stale.
  const head = list.data?.pages[0]
  const failed = head?.type === 'ticket.searched' ? head.search.failure : null
  useEffect(() => {
    if (projectId && failed) onRefused(client, projectId, ticketError(failed, null))
  }, [client, projectId, failed])
  return list
}
