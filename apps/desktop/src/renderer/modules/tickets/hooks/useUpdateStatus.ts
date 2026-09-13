// Moving a Ticket to another status. The row moves at once; a refusal puts it back and says why.
// A Ticket moved to a closed status stays on screen until the backlog is next read.
import { type QueryClient, type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TicketStatus, TicketUpdated } from '@/core/tickets/contract'
import { useToastManager } from '../../../components/ui/toast'
import { type ContractFailure, settle } from '../../../lib/query-client'
import { updateRequest } from '../lib/requests'
import { listKey, onRefused, type TicketPages } from './useTickets'

export type StatusChange = { projectId: string; key: string; status: TicketStatus }

const CLOSED: ReadonlySet<TicketStatus['category']> = new Set(['completed', 'canceled'])

// Every listing of the Project holds the Ticket, searches included.
function move(client: QueryClient, { projectId, key, status }: StatusChange) {
  const state = CLOSED.has(status.category) ? 'closed' : 'open'
  client.setQueriesData<TicketPages>({ queryKey: listKey(projectId) }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            tickets: page.tickets.map((ticket) =>
              ticket.key === key ? { ...ticket, status, state } : ticket,
            ),
          })),
        }
      : data,
  )
}

type Snapshot = [QueryKey, TicketPages | undefined][]

export function useUpdateStatus() {
  const client = useQueryClient()
  const { add } = useToastManager()
  return useMutation<TicketUpdated, ContractFailure, StatusChange, Snapshot>({
    mutationFn: ({ projectId, key, status }) =>
      settle(window.argo.updateStatus(updateRequest(projectId, { key, statusId: status.id }))),
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: listKey(change.projectId) })
      const snapshot = client.getQueriesData<TicketPages>({ queryKey: listKey(change.projectId) })
      move(client, change)
      return snapshot
    },
    onSuccess: ({ projectId, key, status }) => move(client, { projectId, key, status }),
    onError: (failure, { projectId }, snapshot) => {
      for (const [queryKey, data] of snapshot ?? []) client.setQueryData(queryKey, data)
      onRefused(client, projectId, failure)
      add({ title: failure.message, type: 'error', priority: 'high' })
    },
  })
}
