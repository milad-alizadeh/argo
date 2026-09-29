// A Project's Connection and the open Tickets read through it, cached per Project.
import {
  type InfiniteData,
  type QueryClient,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { type ContractFailure, QUERY_KEYS } from '@/platform/renderer/lib/query-client'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'
import type {
  ConnectionSummary,
  TicketConnectedReply,
  TicketDiscoverReply,
  TicketScope,
} from './ticket-reply'
import { type TicketIndexed, type TicketSearched, ticketReply } from './ticket-reply'
import { useActiveTickets } from './use-active-tickets'
import { useSearchedTickets } from './use-searched-tickets'

const connectionKey = (projectId: string) => trpc.ticketConnection.queryKey({ projectId })
// Every cached Ticket listing, saved or searched, sits under this key.
export const listKey = () => trpc.ticketActive.pathKey()

export type TicketPages = InfiniteData<TicketIndexed | TicketSearched, unknown>

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
    queryKey: projectId ? connectionKey(projectId) : [...trpc.ticketConnection.pathKey(), null],
    queryFn: projectId
      ? () => trpcClient.ticketConnection.query({ projectId }).then(ticketReply)
      : skipToken,
    select: (reply) => ticketReply(reply).connection,
  })
}

// The saved active list with no query; a query reads the saved matches and asks the provider.
export function useTicketList(
  projectId: string | null,
  connection: ConnectionSummary | null,
  query = '',
) {
  const ready = projectId !== null && connection?.state === 'ready'
  const searched = useSearchedTickets(projectId, ready && query !== '', query)
  // Saved rows are read from SQLite, so a failed Account still draws them.
  const active = useActiveTickets(
    projectId,
    projectId !== null && connection !== null && query === '',
  )
  return query === '' ? active : searched
}

// The sources an Account could connect this Project to, read only while the form is open.
export function useSources(projectId: string | null, accountId: string | null) {
  const client = useQueryClient()
  return useQuery<TicketDiscoverReply, ContractFailure, TicketScope[]>({
    queryKey: [...trpc.ticketDiscover.pathKey(), projectId, accountId],
    queryFn:
      projectId && accountId
        ? () =>
            trpcClient.ticketDiscover
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
    mutationFn: (input) => trpcClient.ticketConnect.mutate(input),
  })
}

export const useDisconnectSource = () => {
  return useConnectionAction<{ projectId: string }>({
    mutationKey: [...listKey(), 'disconnect'],
    mutationFn: (input) => trpcClient.ticketDisconnect.mutate(input),
  })
}
