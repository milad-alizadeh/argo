// A Project's Binding and the open Tickets read through it, cached per Project.
import {
  type QueryClient,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { BindingSummary, TicketBoundReply } from '@/core/tickets/contract'
import { type ContractFailure, QUERY_KEYS, settle } from '../../../lib/query-client'
import { bindRequest, projectRequest } from '../lib/requests'

const bindingKey = (projectId: string | null) => [...QUERY_KEYS.tickets, projectId, 'binding']
const listKey = (projectId: string | null) => [...QUERY_KEYS.tickets, projectId, 'list']

// A refused or unreadable grant is an Account fact, so the Account listing and this Binding's
// summary are both stale.
const ACCOUNT_FAILURES = new Set(['account-revoked', 'grant-unreadable'])

function onRefused(client: QueryClient, projectId: string, failure: ContractFailure): void {
  if (!ACCOUNT_FAILURES.has(failure.code)) return
  void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
  void client.invalidateQueries({ queryKey: bindingKey(projectId) })
}

export function useBinding(projectId: string | null) {
  return useQuery({
    queryKey: bindingKey(projectId),
    queryFn: projectId
      ? async () =>
          (await settle(window.argo.readBinding(projectRequest('ticket.binding', projectId))))
            .binding
      : skipToken,
  })
}

export function useTicketList(projectId: string | null, binding: BindingSummary | null) {
  const client = useQueryClient()
  const ready = projectId !== null && binding?.state === 'ready'
  return useQuery({
    queryKey: listKey(projectId),
    queryFn: ready
      ? async () => {
          const pending = window.argo.listTickets(projectRequest('ticket.list', projectId))
          const reply = await settle(pending).catch((failure: ContractFailure) => {
            onRefused(client, projectId, failure)
            throw failure
          })
          return reply.tickets
        }
      : skipToken,
  })
}

// Each action names its Project, so a reply lands in that Project's cache whatever is on screen.
function useBindingAction<Input extends { projectId: string }>(
  act: (input: Input) => Promise<TicketBoundReply>,
) {
  const client = useQueryClient()
  return useMutation({
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
