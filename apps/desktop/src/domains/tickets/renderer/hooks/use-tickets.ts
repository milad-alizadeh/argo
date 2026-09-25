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
import { trpc } from '@/platform/renderer/trpc-client'
import { ticketReply } from './ticket-reply'

const connectionKey = (projectId: string) => trpc.tickets.connection.queryKey({ projectId })
export const listKey = () => trpc.tickets.list.pathKey()

export type TicketPages = InfiniteData<TicketListed, string | null>

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
    ...trpc.tickets.connection.queryOptions(projectId ? { projectId } : skipToken),
    select: (reply) => ticketReply(reply).connection,
  })
}

// One page per request, the next asked for as the list scrolls; a new query keeps the last
// answer on screen until its own arrives.
export function useTicketList(
  projectId: string | null,
  connection: ConnectionSummary | null,
  query = '',
) {
  const client = useQueryClient()
  const ready = projectId !== null && connection?.state === 'ready'
  return useInfiniteQuery<TicketListReply, ContractFailure, TicketPages, QueryKey, string | null>({
    ...trpc.tickets.list.infiniteQueryOptions(
      ready ? { projectId, query, cursor: null } : skipToken,
      {
        initialCursor: null,
        getNextPageParam: (last) => ticketReply(last).nextCursor ?? undefined,
        placeholderData: keepPreviousData,
      },
    ),
    select: (data) => ({ ...data, pages: data.pages.map(ticketReply) }),
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
    ...trpc.tickets.discover.queryOptions(
      projectId && accountId ? { projectId, accountId } : skipToken,
    ),
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
      const connected = ticketReply(reply)
      client.setQueryData(connectionKey(projectId), connected.connection)
      void client.invalidateQueries({ queryKey: listKey() })
      void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
    },
    onError: (failure, { projectId }) => onRefused(client, projectId, failure),
  })
}

export type ConnectInput = { projectId: string; accountId: string; scope: string }

export const useConnectSource = () => {
  const options = trpc.tickets.connect.mutationOptions()
  return useConnectionAction<ConnectInput>({
    mutationKey: options.mutationKey,
    mutationFn: options.mutationFn,
  })
}

export const useDisconnectSource = () => {
  const options = trpc.tickets.disconnect.mutationOptions()
  return useConnectionAction<{ projectId: string }>({
    mutationKey: options.mutationKey,
    mutationFn: options.mutationFn,
  })
}
