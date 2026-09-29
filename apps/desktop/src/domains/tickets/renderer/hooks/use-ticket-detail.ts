// One Ticket opened by reference: its saved row from SQLite, and one by-ID provider read that
// commits it before the row is read again, so a Ticket outside the active list still opens.
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Ticket, TicketStatus } from '@/domains/tickets/contract/contract'
import { type ContractFailure, settle } from '@/platform/renderer/lib/query-client'
import { type RouterOutputs, trpc, trpcClient } from '@/platform/renderer/trpc-client'
import { onRefused } from './use-tickets'

// Every cached saved Ticket sits under this key, which each committed change refetches.
export const detailKey = () => trpc.ticketDetail.pathKey()

export type TicketDetailRead = {
  // The saved Ticket, which stays readable after the active list moves on.
  ticket: Ticket | null
  statuses: readonly TicketStatus[]
  // Neither SQLite nor the provider has answered yet.
  reading: boolean
  // The provider read failed; a saved Ticket is still drawn beside it.
  failure: ContractFailure | null
  retry: () => void
}

type Target = { projectId: string; reference: string }
type Detail = Extract<RouterOutputs['ticketDetail'], { type: 'ticket.detail' }>

export function useTicketDetail(
  projectId: string | null,
  reference: string | null,
  enabled: boolean,
): TicketDetailRead {
  const client = useQueryClient()
  const target: Target | null =
    enabled && projectId !== null && reference !== null ? { projectId, reference } : null
  const saved = useQuery<Detail, ContractFailure>({
    queryKey: [...detailKey(), projectId, reference],
    queryFn: target ? () => settle(trpcClient.ticketDetail.query(target)) : skipToken,
  })
  const open = useMutation<unknown, ContractFailure, Target>({
    mutationFn: (input) => settle(trpcClient.ticketOpen.mutate(input)),
    // The reply follows the commit, so this read sees the provider's answer.
    onSuccess: () => void client.invalidateQueries({ queryKey: detailKey() }),
    onError: (failure, input) => onRefused(client, input.projectId, failure),
  })
  const { mutate, reset } = open
  const openProject = target?.projectId ?? null
  const openReference = target?.reference ?? null
  // Each Ticket opened reads the provider once, whether or not a row is already saved.
  useEffect(() => {
    if (openProject === null || openReference === null) return
    reset()
    mutate({ projectId: openProject, reference: openReference })
  }, [openProject, openReference, mutate, reset])
  const ticket = saved.data?.ticket ?? null
  return {
    ticket,
    statuses: saved.data?.statuses ?? [],
    reading: ticket === null && (saved.isPending || open.isPending || open.isIdle),
    failure: open.error ?? saved.error ?? null,
    retry: () => {
      if (target) mutate(target)
    },
  }
}
