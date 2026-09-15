// The optimistic-mutation shape shared by every field a Ticket can be moved to: the row moves at
// once, a listing not yet reloaded moves too, and a refusal puts every moved row back and says why.
import { type QueryClient, type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Ticket } from '@/core/tickets/contract'
import { useToastManager } from '../../../components/ui/toast'
import { useContractText } from '../../../i18n/contract-text'
import { type ContractFailure, settle } from '../../../lib/query-client'
import { listKey, onRefused, type TicketPages } from './useTickets'

export type TicketChange = { projectId: string; key: string }
type Snapshot = [QueryKey, TicketPages | undefined][]

// The one Ticket named by `key`, patched across every cached listing of the Project, searches
// included. Every field a Ticket can be moved to shares this traversal and supplies its own patch.
export function patchTicket(
  client: QueryClient,
  { projectId, key }: TicketChange,
  patch: (ticket: Ticket) => Ticket,
) {
  client.setQueriesData<TicketPages>({ queryKey: listKey(projectId) }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            tickets: page.tickets.map((ticket) => (ticket.key === key ? patch(ticket) : ticket)),
          })),
        }
      : data,
  )
}

export function useTicketFieldMutation<
  Reply extends { type: string },
  Change extends TicketChange,
>({
  move,
  request,
  reply,
}: {
  move: (client: QueryClient, change: Change) => void
  request: (change: Change) => Promise<Reply | ContractFailure>
  reply: (reply: Reply) => Change
}) {
  const client = useQueryClient()
  const { add } = useToastManager()
  const contractText = useContractText()
  return useMutation<Reply, ContractFailure, Change, Snapshot>({
    mutationFn: (change) => settle(request(change)),
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: listKey(change.projectId) })
      const snapshot = client.getQueriesData<TicketPages>({ queryKey: listKey(change.projectId) })
      move(client, change)
      return snapshot
    },
    onSuccess: (value) => move(client, reply(value)),
    onError: (failure, { projectId }, snapshot) => {
      for (const [queryKey, data] of snapshot ?? []) client.setQueryData(queryKey, data)
      onRefused(client, projectId, failure)
      add({ title: contractText(failure), type: 'error', priority: 'high' })
    },
  })
}
