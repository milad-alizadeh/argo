// Moving a Ticket to another priority level, or to none. The row moves at once; a refusal puts
// it back and says why.
import type { QueryClient } from '@tanstack/react-query'
import type { TicketPrioritized, TicketPriority } from '@/domains/tickets/contract/contract'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { patchTicket, type TicketChange, useTicketFieldMutation } from './use-ticket-field-mutation'

export type PriorityChange = TicketChange & { priority: TicketPriority | null }

function move(client: QueryClient, change: PriorityChange) {
  patchTicket(client, change, (ticket) => ({ ...ticket, priority: change.priority }))
}

export function useUpdatePriority() {
  return useTicketFieldMutation<TicketPrioritized, PriorityChange>({
    move,
    request: ({ projectId, key, priority }) =>
      trpcClient.tickets.updatePriority.mutate({
        projectId,
        key,
        priorityLevel: priority?.level ?? null,
      }),
    reply: ({ projectId, key, priority }) => ({ projectId, key, priority }),
  })
}
