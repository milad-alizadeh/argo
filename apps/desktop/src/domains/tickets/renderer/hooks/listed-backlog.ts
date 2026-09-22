// A connected Project's pages of Tickets, read into the Backlog the deck draws.
import type { UseInfiniteQueryResult } from '@tanstack/react-query'
import { type Backlog, uniqueTickets } from '@/domains/tickets/renderer/lib/backlog'
import { contractText } from '@/platform/renderer/i18n/contract-text'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import type { TicketPages } from './use-tickets'

export type TicketListing = UseInfiniteQueryResult<TicketPages, ContractFailure>

type Listing = {
  list: TicketListing
  query: string
  onChangeStatus: Backlog['onChangeStatus']
  onChangePriority: Backlog['onChangePriority']
}

export function listedBacklog(
  pages: TicketPages,
  { list, query, onChangeStatus, onChangePriority }: Listing,
): Omit<Backlog, 'provider'> {
  const loadMore = () => {
    if (!list.isFetching) void list.fetchNextPage()
  }
  return {
    tickets: uniqueTickets(pages.pages),
    statuses: pages.pages[0]?.statuses ?? [],
    onChangeStatus,
    onChangePriority,
    query,
    total: pages.pages[0]?.total ?? null,
    hasMore: list.hasNextPage,
    loadingMore: list.isFetchingNextPage,
    loadMoreError: list.isFetchNextPageError ? contractText(list.error) : null,
    searching: list.isPlaceholderData,
    onLoadMore: loadMore,
    onRetryLoadMore: loadMore,
  }
}
