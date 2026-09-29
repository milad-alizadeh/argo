// One Ticket opened by reference: its saved row from SQLite, and one by-ID provider read that
// commits it before the row is read again, so a Ticket outside the active list still opens.
import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Ticket, TicketStatus } from '@/domains/tickets/api/ticket'
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
  // The provider read failed; a saved Ticket is still drawn below it.
  failure: ContractFailure | null
  retry: () => void
}

type Target = { projectId: string; reference: string }
type Detail = Extract<RouterOutputs['ticketDetail'], { type: 'ticket.detail' }>
type Opened = Extract<RouterOutputs['ticketOpen'], { type: 'ticket.opened' }>

export function useTicketDetail(
  projectId: string | null,
  reference: string | null,
  enabled: boolean,
): TicketDetailRead {
  const client = useQueryClient()
  const target: Target | null =
    enabled && projectId !== null && reference !== null ? { projectId, reference } : null
  const open = useMutation<Opened, ContractFailure, Target>({
    mutationFn: (input) => settle(trpcClient.ticketOpen.mutate(input)),
    // Awaited, so the read stays pending until the committed row is fetched.
    onSuccess: () => client.invalidateQueries({ queryKey: detailKey() }),
    onError: (failure, input) => onRefused(client, input.projectId, failure),
  })
  // The provider may resolve the reference to a key it no longer matches, so read by Argo UUID.
  const current = open.variables?.projectId === projectId && open.variables?.reference === reference
  const readReference = (current ? open.data?.argoId : undefined) ?? reference
  const saved = useQuery<Detail, ContractFailure>({
    queryKey: [...detailKey(), projectId, readReference],
    queryFn:
      target && readReference !== null
        ? () =>
            settle(
              trpcClient.ticketDetail.query({
                projectId: target.projectId,
                reference: readReference,
              }),
            )
        : skipToken,
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
