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
  TicketConnected,
  TicketConnectedReply,
  TicketListed,
} from '@/core/tickets/contract'
import { type ContractFailure, QUERY_KEYS, settle } from '../../../lib/query-client'
import { connectRepositoryRequest, listRequest, projectRequest } from '../lib/requests'

const connectionKey = (projectId: string | null) => [...QUERY_KEYS.tickets, projectId, 'connection']
// The prefix without a query names every listing of the Project, searches included.
const listKey = (projectId: string | null, query?: string) =>
  query === undefined
    ? [...QUERY_KEYS.tickets, projectId, 'list']
    : [...QUERY_KEYS.tickets, projectId, 'list', query]

export type TicketPages = InfiniteData<TicketListed, number>

// A refused or unreadable grant is an Account fact, so the Account listing and this Connection's
// summary are both stale.
const ACCOUNT_FAILURES = new Set(['account-revoked', 'grant-unreadable'])

function onRefused(client: QueryClient, projectId: string, failure: ContractFailure): void {
  if (!ACCOUNT_FAILURES.has(failure.code)) return
  void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
  void client.invalidateQueries({ queryKey: connectionKey(projectId) })
}

export function useConnection(projectId: string | null) {
  return useQuery<ConnectionSummary | null, ContractFailure>({
    queryKey: connectionKey(projectId),
    queryFn: projectId
      ? async () =>
          (await settle(window.argo.readConnection(projectRequest('ticket.connection', projectId))))
            .connection
      : skipToken,
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
  return useInfiniteQuery<TicketListed, ContractFailure, TicketPages, QueryKey, number>({
    queryKey: listKey(projectId, query),
    queryFn: ready
      ? ({ pageParam }) =>
          settle(window.argo.listTickets(listRequest(projectId, query, pageParam))).catch(
            (failure: ContractFailure) => {
              onRefused(client, projectId, failure)
              throw failure
            },
          )
      : skipToken,
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage ?? undefined,
    placeholderData: keepPreviousData,
  })
}

// Each action names its Project, so a reply lands in that Project's cache whatever is on screen.
function useConnectionAction<Input extends { projectId: string }>(
  act: (input: Input) => Promise<TicketConnectedReply>,
) {
  const client = useQueryClient()
  return useMutation<TicketConnected, ContractFailure, Input>({
    mutationFn: (input: Input) => settle(act(input)),
    onSuccess: (reply, { projectId }) => {
      client.setQueryData(connectionKey(projectId), reply.connection)
      void client.invalidateQueries({ queryKey: listKey(projectId) })
      void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
    },
    onError: (failure, { projectId }) => onRefused(client, projectId, failure),
  })
}

export type ConnectInput = { projectId: string; accountId: string; scope: string }

export const useConnectRepository = () =>
  useConnectionAction(({ projectId, ...target }: ConnectInput) =>
    window.argo.connectRepository(connectRepositoryRequest(projectId, target)),
  )

export const useDisconnectRepository = () =>
  useConnectionAction(({ projectId }: { projectId: string }) =>
    window.argo.disconnectRepository(projectRequest('ticket.disconnect', projectId)),
  )
