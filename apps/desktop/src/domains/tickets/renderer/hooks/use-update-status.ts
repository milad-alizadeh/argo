// Moving a Ticket to another status. The row moves at once; a refusal puts it back and says why.
// A Ticket moved to a closed status stays on screen until the backlog is next read.
import type { QueryClient } from '@tanstack/react-query'
import type { TicketUpdated } from '@/domains/tickets/contract/contract'
import { closureOf, type TicketStatus } from '@/domains/tickets/contract/ticket'
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
    request: ({ projectId, key, status }) =>
      trpcClient.tickets.updateStatus.mutate({ projectId, key, statusId: status.id }),
    reply: ({ projectId, key, status }) => ({ projectId, key, status }),
  })
}
