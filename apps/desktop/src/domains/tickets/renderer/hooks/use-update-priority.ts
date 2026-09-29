// Moving a Ticket to another priority level, or to none. The row moves when the provider's
// confirmed priority is saved; a refusal leaves it where it was and says why.
import type { QueryClient } from '@tanstack/react-query'
import type { TicketPriority } from '@/domains/tickets/api/ticket'
import { trpcClient } from '@/platform/renderer/trpc-client'
import type { TicketPrioritized } from './ticket-reply'
import { patchTicket, type TicketChange, useTicketFieldMutation } from './use-ticket-field-mutation'

export type PriorityChange = TicketChange & { priority: TicketPriority | null }

function move(client: QueryClient, change: PriorityChange) {
  patchTicket(client, change, (ticket) => ({ ...ticket, priority: change.priority }))
}

export function useUpdatePriority() {
  return useTicketFieldMutation<TicketPrioritized, PriorityChange>({
    move,
    optimistic: false,
    request: ({ projectId, key, priority }) =>
      trpcClient.ticketUpdatePriority.mutate({
        projectId,
        key,
        priorityLevel: priority?.level ?? null,
      }),
    reply: ({ projectId, key, priority }) => ({ projectId, key, priority }),
  })
}
