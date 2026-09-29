// Moving a Ticket to another status. The row moves when the provider's confirmed status is saved;
// a refusal leaves it where it was and says why. A Ticket moved to a closed status stays on screen
// until the backlog is next read.
import type { QueryClient } from '@tanstack/react-query'
import type { TicketUpdated } from '@/domains/tickets/api/messages'
import { closureOf, type TicketStatus } from '@/domains/tickets/api/ticket'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { patchTicket, type TicketChange, useTicketFieldMutation } from './use-ticket-field-mutation'

export type StatusChange = TicketChange & { status: TicketStatus }

function move(client: QueryClient, change: StatusChange) {
  const state = closureOf(change.status.category)
  patchTicket(client, change, (ticket) => ({ ...ticket, status: change.status, state }))
}

export function useUpdateStatus() {
  return useTicketFieldMutation<TicketUpdated, StatusChange>({
    move,
    optimistic: false,
    request: ({ projectId, key, status }) =>
      trpcClient.ticketUpdateStatus.mutate({ projectId, key, statusId: status.id }),
    reply: ({ projectId, key, status }) => ({ projectId, key, status }),
  })
}
