// The priority levels a Project's provider offers, read from the provider and kept for the Project.
import { skipToken, useQuery } from '@tanstack/react-query'
import type {
  ConnectionSummary,
  TicketPriority,
  TicketPriorityChoicesReply,
} from '@/domains/tickets/contract/contract'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'
import { providerPresentation } from '@/providers/presentation-registry'
import { ticketReply } from './ticket-reply'

const NONE: readonly TicketPriority[] = []

// Empty until the provider answers and after it fails, so a menu offers nothing it did not confirm.
export function usePriorityChoices(projectId: string | null, connection: ConnectionSummary | null) {
  const enabled =
    connection?.state === 'ready' && providerPresentation(connection.provider).hasPriority
  const choices = useQuery<TicketPriorityChoicesReply, ContractFailure, readonly TicketPriority[]>({
    queryKey: [...trpc.ticketPriorityChoices.pathKey(), projectId],
    queryFn:
      enabled && projectId
        ? () => trpcClient.ticketPriorityChoices.query({ projectId }).then(ticketReply)
        : skipToken,
    select: (reply) => ticketReply(reply).choices,
    staleTime: Number.POSITIVE_INFINITY,
  })
  return choices.data ?? NONE
}
