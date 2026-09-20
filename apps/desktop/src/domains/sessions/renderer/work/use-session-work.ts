// The two reads the work rail needs beyond the Roster row it already has (#1582): what each
// Subagent spent, and what one background Shell has written so far. Neither rides the Roster or
// Feed reply, and each stops polling once the thing it watches has finished.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { SubagentUsageFacts } from '@/domains/sessions/contract/model/background-work-contract'
import { sessionFeedQuery } from '@/domains/sessions/renderer/feed/session-feed-query'
import type { SessionContractError } from '@/domains/sessions/renderer/session-contract-error'
import {
  SESSION_REFRESH_MS,
  sessionShellOutputQueryKey,
  sessionSubagentUsageQueryKey,
} from '@/domains/sessions/renderer/session-queries'
import type { SessionFeed, SessionId } from '@/domains/sessions/renderer/types'
import { useWatchedQueries } from '@/domains/sessions/renderer/use-watched-topic'

// Each read re-parses every Subagent transcript the Session has, so a Session whose Subagents have
// all come back is read once rather than on every pass.
export function useDelegationUsage(sessionId: SessionId | null, live: boolean) {
  const queryKey = sessionSubagentUsageQueryKey(sessionId ?? '')
  const usage = useQuery<Record<string, SubagentUsageFacts>>({
    queryKey,
    enabled: sessionId !== null,
    gcTime: 0,
    placeholderData: (previous) => previous,
    retry: false,
    queryFn: async () => {
      if (sessionId === null) return {}
      const reply = await window.argo.readSubagentUsage({ sessionId })
      if (reply.type !== 'session.subagent.usage.read') return {}
      return Object.fromEntries(reply.usage.map(({ id, tokens, model }) => [id, { tokens, model }]))
    },
  })
  // A Subagent's transcript is what carries its token count, and it sits under the same watched
  // trees as its Session's own, so the count follows the write instead of a timer (#2303).
  useWatchedQueries('sessions', live ? [queryKey] : [])
  return usage.data ?? {}
}

// A running command keeps writing, so its output is polled at the Feed's own rate. A finished one
// no longer changes, so it is read once and kept, and the previous text stays on screen while that
// last read is in flight.
export function useShellOutput(sessionId: SessionId | null, shellId: string | null, live: boolean) {
  const output = useQuery<string | null>({
    queryKey: sessionShellOutputQueryKey(sessionId ?? '', shellId ?? '', live),
    enabled: sessionId !== null && shellId !== null,
    gcTime: 0,
    placeholderData: (previous) => previous,
    refetchInterval: live ? SESSION_REFRESH_MS : false,
    retry: false,
    queryFn: async () => {
      if (sessionId === null || shellId === null) return null
      const reply = await window.argo.readShellOutput({ sessionId, shellId })
      return reply.type === 'session.shell.output.read' ? reply.output : null
    },
  })
  return output.data ?? null
}

// One Subagent's own transcript, read as its own document so the Session's Feed is never displaced
// by it. Null until a Subagent is picked.
export function useDelegationFeed(sessionId: SessionId | null, subagentId: string | null) {
  const queryClient = useQueryClient()
  const query = sessionFeedQuery(queryClient, subagentId === null ? null : sessionId, subagentId)
  const feed = useQuery<SessionFeed | null, SessionContractError>(query)
  // A Subagent's transcript sits under the same watched trees as its Session's own.
  useWatchedQueries('sessions', [query.queryKey])
  return feed.data ?? null
}
