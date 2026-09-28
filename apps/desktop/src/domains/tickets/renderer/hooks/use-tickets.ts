// A Project's Connection and the open Tickets read through it, cached per Project.
import {
  type InfiniteData,
  keepPreviousData,
  type QueryClient,
  type QueryKey,
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  ConnectionSummary,
  TicketConnectedReply,
  TicketDiscoverReply,
  TicketListed,
  TicketListReply,
  TicketScope,
} from '@/domains/tickets/contract/contract'
import { type ContractFailure, QUERY_KEYS } from '@/platform/renderer/lib/query-client'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'
import { type TicketIndexed, ticketReply } from './ticket-reply'
import { useActiveTickets } from './use-active-tickets'

const connectionKey = (projectId: string) => trpc.tickets.connection.queryKey({ projectId })
// Every cached Ticket listing, saved or searched, sits under this key.
export const listKey = () => trpc.tickets.list.pathKey()

export type TicketPages = InfiniteData<TicketListed | TicketIndexed, unknown>

// An expired, refused or unreadable grant is an Account fact, so the Account listing and this Connection's
// summary are both stale.
const ACCOUNT_FAILURES = new Set(['account-expired', 'account-revoked', 'grant-unreadable'])

export function onRefused(client: QueryClient, projectId: string, failure: ContractFailure): void {
  if (!ACCOUNT_FAILURES.has(failure.code)) return
  void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
  void client.invalidateQueries({ queryKey: connectionKey(projectId) })
}

export function useConnection(projectId: string | null) {
  return useQuery<TicketConnectedReply, ContractFailure, ConnectionSummary | null>({
    queryKey: projectId ? connectionKey(projectId) : [...trpc.tickets.connection.pathKey(), null],
    queryFn: projectId
      ? () => trpcClient.tickets.connection.query({ projectId }).then(ticketReply)
      : skipToken,
    select: (reply) => ticketReply(reply).connection,
  })
}

// The saved active list with no query; a query searches the provider.
export function useTicketList(
  projectId: string | null,
  connection: ConnectionSummary | null,
  query = '',
) {
  const ready = projectId !== null && connection?.state === 'ready'
  const searched = useSearchedTickets(projectId, ready && query !== '', query)
  const active = useActiveTickets(projectId, ready && query === '')
  return query === '' ? active : searched
}

// One page per scroll request; a new query keeps the last answer until its own arrives.
function useSearchedTickets(projectId: string | null, ready: boolean, query: string) {
  const client = useQueryClient()
  return useInfiniteQuery<TicketListReply, ContractFailure, TicketPages, QueryKey, string | null>({
    queryKey: [...listKey(), projectId, query],
    queryFn:
      ready && projectId
        ? ({ pageParam }) =>
            trpcClient.tickets.list
              .query({ projectId, query, cursor: pageParam })
              .then(ticketReply)
              .catch((failure: ContractFailure) => {
                onRefused(client, projectId, failure)
                throw failure
              })
        : skipToken,
    initialPageParam: null,
    getNextPageParam: (last) => ticketReply(last).nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    throwOnError: (failure) => {
      if (projectId) onRefused(client, projectId, failure)
      return false
    },
  })
}

// The sources an Account could connect this Project to, read only while the form is open.
export function useSources(projectId: string | null, accountId: string | null) {
  const client = useQueryClient()
  return useQuery<TicketDiscoverReply, ContractFailure, TicketScope[]>({
    queryKey: [...trpc.tickets.discover.pathKey(), projectId, accountId],
    queryFn:
      projectId && accountId
        ? () =>
            trpcClient.tickets.discover
              .query({ projectId, accountId })
              .then(ticketReply)
              .catch((failure: ContractFailure) => {
                onRefused(client, projectId, failure)
                throw failure
              })
        : skipToken,
    select: (reply) => ticketReply(reply).scopes,
    throwOnError: (failure) => {
      if (projectId) onRefused(client, projectId, failure)
      return false
    },
  })
}

// Each action names its Project, so a reply lands in that Project's cache whatever is on screen.
function useConnectionAction<Input extends { projectId: string }>(options: {
  mutationFn: (input: Input) => Promise<TicketConnectedReply>
  mutationKey?: readonly unknown[]
}) {
  const client = useQueryClient()
  return useMutation<TicketConnectedReply, ContractFailure, Input>({
    ...options,
    onSuccess: (reply, { projectId }) => {
      client.setQueryData(connectionKey(projectId), ticketReply(reply))
      void client.invalidateQueries({ queryKey: listKey() })
      void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
    },
    onError: (failure, { projectId }) => onRefused(client, projectId, failure),
  })
}

export type ConnectInput = { projectId: string; accountId: string; scope: string }

export const useConnectSource = () => {
  return useConnectionAction<ConnectInput>({
    mutationKey: [...listKey(), 'connect'],
    mutationFn: (input) => trpcClient.tickets.connect.mutate(input),
  })
}

export const useDisconnectSource = () => {
  return useConnectionAction<{ projectId: string }>({
    mutationKey: [...listKey(), 'disconnect'],
    mutationFn: (input) => trpcClient.tickets.disconnect.mutate(input),
  })
}
