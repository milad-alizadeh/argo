// The two reads the work rail needs beyond the Roster row it already has (#1582): what each
// Subagent spent, and what one background Shell has written so far. Neither rides the Roster or
// Feed reply.
import { useQuery } from '@tanstack/react-query'
import { trpcClient } from '@/platform/renderer/trpc-client'
import { useFeedReading } from '../feed'
import {
  SESSION_REFRESH_MS,
  sessionShellOutputQueryKey,
  sessionSubagentUsageQueryKey,
} from '../session-queries'
import type { SessionId } from '../types'
import type { SessionShellOutput, SubagentUsageFacts } from './types'

// Each read re-parses every Subagent transcript the Session has, so a Session whose Subagents have
// all come back is read once rather than on every pass.
export function useDelegationUsage(sessionId: SessionId | null) {
  const queryKey = sessionSubagentUsageQueryKey(sessionId ?? '')
  const usage = useQuery<Record<string, SubagentUsageFacts>>({
    queryKey,
    enabled: sessionId !== null,
    gcTime: 0,
    placeholderData: (previous) => previous,
    retry: false,
    queryFn: async () => {
      if (sessionId === null) return {}
      const reply = await trpcClient.sessionSubagentUsage.query({ sessionId })
      return Object.fromEntries(reply.usage.map(({ id, tokens, model }) => [id, { tokens, model }]))
    },
  })
  return usage.data ?? {}
}

// A running command keeps writing, so its output is polled while active. A finished one
// no longer changes, so it is read once and kept, and the previous text stays on screen while that
// last read is in flight.
export function useShellOutput(sessionId: SessionId | null, shellId: string | null, live: boolean) {
  const output = useQuery<SessionShellOutput | null>({
    queryKey: sessionShellOutputQueryKey(sessionId ?? '', shellId ?? '', live),
    enabled: sessionId !== null && shellId !== null,
    gcTime: 0,
    placeholderData: (previous) => previous,
    refetchInterval: live ? SESSION_REFRESH_MS : false,
    retry: false,
    queryFn: async () => {
      if (sessionId === null || shellId === null) return null
      const reply = await trpcClient.sessionShellOutput.query({ sessionId, shellId })
      return reply
    },
  })
  return output.data ?? null
}

// One Subagent's own Feed, read by main as its own chain so the Session's Feed is never displaced
// by it. Null until a Subagent is picked.
export function useDelegationFeed(
  sessionId: SessionId | null,
  subagentId: string | null,
  running: boolean,
) {
  const reading = useFeedReading(subagentId === null ? null : sessionId, subagentId, running)
  return { feed: reading.feed, feedError: reading.feedError, retry: reading.retryFeed }
}
