// Moving a Ticket to another status. The row moves at once; a refusal puts it back and says why.
// A Ticket moved to a closed status stays on screen until the backlog is next read.
import type { QueryClient } from '@tanstack/react-query'
import type { TicketUpdated } from '@/core/tickets/contract'
import { closureOf, type TicketStatus } from '@/core/tickets/ticket'
import { patchTicket, type TicketChange, useTicketFieldMutation } from './useTicketFieldMutation'

export type StatusChange = TicketChange & { status: TicketStatus }

function move(client: QueryClient, { projectId, key, status }: StatusChange) {
  const state = closureOf(status.category)
  patchTicket(client, projectId, key, (ticket) => ({ ...ticket, status, state }))
}

export function useUpdateStatus() {
  return useTicketFieldMutation<TicketUpdated, StatusChange>({
    move,
    request: ({ projectId, key, status }) =>
      window.argo.updateStatus({ projectId, key, statusId: status.id }),
    reply: ({ projectId, key, status }) => ({ projectId, key, status }),
  })
}
