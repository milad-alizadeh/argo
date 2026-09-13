// A connected Project's pages of Tickets, read into the Backlog the deck draws.
import type { UseInfiniteQueryResult } from '@tanstack/react-query'
import type { ContractFailure } from '../../../lib/query-client'
import { type Backlog, uniqueTickets } from '../lib/backlog'
import type { TicketPages } from './useTickets'

export type TicketListing = UseInfiniteQueryResult<TicketPages, ContractFailure>

type Listing = {
  list: TicketListing
  query: string
  onChangeStatus: Backlog['onChangeStatus']
}

export function listedBacklog(
  pages: TicketPages,
  { list, query, onChangeStatus }: Listing,
): Omit<Backlog, 'provider'> {
  const loadMore = () => {
    if (!list.isFetching) void list.fetchNextPage()
  }
  return {
    tickets: uniqueTickets(pages.pages),
    statuses: pages.pages[0]?.statuses ?? [],
    onChangeStatus,
    query,
    total: pages.pages[0]?.total ?? null,
    hasMore: list.hasNextPage,
    loadingMore: list.isFetchingNextPage,
    loadMoreError: list.isFetchNextPageError ? list.error.message : null,
    searching: list.isPlaceholderData,
    onLoadMore: loadMore,
    onRetryLoadMore: loadMore,
  }
}
