import { type QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Provider } from '@/domains/accounts/contract/contract'
import type { Ticket } from '@/domains/tickets/api/ticket'
import { QUERY_KEYS } from '@/platform/renderer/lib/query-client'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'
import type { TicketChoice } from './context-picker/context-picker-contents'
import { ticketChoice } from './ticket-choice'

const ACCOUNT_FAILURES = new Set(['account-expired', 'account-revoked', 'grant-unreadable'])
const QUIET_CONNECTION = new Set(['not-connected', 'missing-project'])

function savedTickets(reply: { type: string; tickets?: Ticket[] } | undefined): Ticket[] {
  if (reply?.type === 'ticket.indexed' || reply?.type === 'ticket.searched')
    return reply.tickets ?? []
  return []
}

function refusalCode(reply: { type: string; code?: string } | undefined) {
  return reply?.type === 'ticket.error' ? reply.code : undefined
}

function useTicketPages(projectId: string | null, trimmed: string, ready: boolean) {
  const active = useQuery({
    queryKey: ['composer-tickets', 'active', projectId],
    enabled: ready && trimmed.length === 0,
    queryFn: () => trpcClient.ticketActive.query({ projectId: projectId ?? '', page: 0 }),
  })
  const search = useQuery({
    queryKey: ['composer-tickets', 'search', projectId, trimmed],
    enabled: ready && trimmed.length >= 1,
    queryFn: () =>
      trpcClient.ticketSearch.query({ projectId: projectId ?? '', query: trimmed, page: 0 }),
  })
  return { active, search }
}

function useTicketFollow(input: {
  client: QueryClient
  projectId: string | null
  trimmed: string
  ready: boolean
  enabled: boolean
}) {
  const { client, projectId, trimmed, ready, enabled } = input
  useEffect(() => {
    if (!ready || projectId === null || trimmed.length < 1) return
    let cancelled = false
    void trpcClient.ticketSearchProvider.mutate({ projectId, query: trimmed }).then(
      (reply) => {
        const code = refusalCode(reply)
        if (!cancelled && code !== undefined && ACCOUNT_FAILURES.has(code)) {
          void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
          void client.invalidateQueries({ queryKey: trpc.ticketConnection.queryKey({ projectId }) })
        }
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [client, projectId, ready, trimmed])

  useEffect(() => {
    if (!enabled || projectId === null) return
    const subscription = trpcClient.ticketChanges.subscribe(undefined, {
      onData: () => {
        void client.invalidateQueries({ queryKey: ['composer-tickets', 'active', projectId] })
        void client.invalidateQueries({ queryKey: ['composer-tickets', 'search', projectId] })
      },
      onError: () => {},
    })
    return () => subscription.unsubscribe()
  }, [client, enabled, projectId])
}

export function useComposerTickets(
  projectId: string | null,
  query: string,
  enabled: boolean,
): TicketChoice[] {
  const client = useQueryClient()
  const trimmed = query.trim()
  const connection = useQuery({
    queryKey: ['composer-tickets', 'connection', projectId],
    enabled: enabled && projectId !== null,
    queryFn: () => trpcClient.ticketConnection.query({ projectId: projectId ?? '' }),
  })
  const connected = connection.data?.type === 'ticket.connected' ? connection.data.connection : null
  const connectionCode = refusalCode(connection.data)
  const quiet =
    connected === null || (connectionCode !== undefined && QUIET_CONNECTION.has(connectionCode))
  const ready = enabled && projectId !== null && connected !== null && !quiet
  const { active, search } = useTicketPages(projectId, trimmed, ready)
  useTicketFollow({ client, projectId, trimmed, ready, enabled })

  const refusal = [connection.data, active.data, search.data]
    .map((reply) => refusalCode(reply))
    .find((code) => code !== undefined && ACCOUNT_FAILURES.has(code))
  useEffect(() => {
    if (projectId === null || refusal === undefined) return
    void client.invalidateQueries({ queryKey: QUERY_KEYS.accounts })
    void client.invalidateQueries({ queryKey: trpc.ticketConnection.queryKey({ projectId }) })
  }, [client, projectId, refusal])

  if (!ready || connected === null) return []
  const provider: Provider = connected.provider
  const reply = trimmed.length === 0 ? active.data : search.data
  return savedTickets(reply).map((ticket) => ticketChoice(provider, ticket))
}
