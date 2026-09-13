// A Project's Binding and the open Tickets read through it, cached per Project.
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
  BindingSummary,
  TicketBound,
  TicketBoundReply,
  TicketListed,
} from '@/core/tickets/contract'
import { type ContractFailure, QUERY_KEYS, settle } from '../../../lib/query-client'
import { bindRequest, listRequest, projectRequest } from '../lib/requests'

const bindingKey = (projectId: string | null) => [...QUERY_KEYS.tickets, projectId, 'binding']
// The prefix without a query names every listing of the Project, searches included.
const listKey = (projectId: string | null, query?: string) =>
  query === undefined
    ? [...QUERY_KEYS.tickets, projectId, 'list']
    : [...QUERY_KEYS.tickets, projectId, 'list', query]

export type TicketPages = InfiniteData<TicketListed, number>

// A refused or unreadable grant is an Account fact, so the Account listing and this Binding's
// summary are both stale.
const ACCOUNT_FAILURES = new Set(['account-revoked', 'grant-unreadable'])

function onRefused(client: QueryClient, projectId: string, failure: ContractFailure): void {
  if (!ACCOUNT_FAILURES.has(failure.code)) return
  void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
  void client.invalidateQueries({ queryKey: bindingKey(projectId) })
}

export function useBinding(projectId: string | null) {
  return useQuery<BindingSummary | null, ContractFailure>({
    queryKey: bindingKey(projectId),
    queryFn: projectId
      ? async () =>
          (await settle(window.argo.readBinding(projectRequest('ticket.binding', projectId))))
            .binding
      : skipToken,
  })
}

// One page per request, the next asked for as the list scrolls; a new query keeps the last
// answer on screen until its own arrives.
export function useTicketList(
  projectId: string | null,
  binding: BindingSummary | null,
  query = '',
) {
  const client = useQueryClient()
  const ready = projectId !== null && binding?.state === 'ready'
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
function useBindingAction<Input extends { projectId: string }>(
  act: (input: Input) => Promise<TicketBoundReply>,
) {
  const client = useQueryClient()
  return useMutation<TicketBound, ContractFailure, Input>({
    mutationFn: (input: Input) => settle(act(input)),
    onSuccess: (reply, { projectId }) => {
      client.setQueryData(bindingKey(projectId), reply.binding)
      void client.invalidateQueries({ queryKey: listKey(projectId) })
      void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
    },
    onError: (failure, { projectId }) => onRefused(client, projectId, failure),
  })
}

export type BindInput = { projectId: string; accountId: string; scope: string }

export const useBind = () =>
  useBindingAction(({ projectId, ...target }: BindInput) =>
    window.argo.bindTickets(bindRequest(projectId, target)),
  )

export const useUnbind = () =>
  useBindingAction(({ projectId }: { projectId: string }) =>
    window.argo.unbindTickets(projectRequest('ticket.unbind', projectId)),
  )
