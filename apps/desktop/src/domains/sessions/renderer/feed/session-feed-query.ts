// One read of one Feed document, whether it is a Session's own or one Subagent's (#1582). Both
// callers share this so the revision handshake, which answers `session.feed.unchanged` and expects
// the holder to keep what it already has, is written once.
import type { QueryClient, QueryKey, UseQueryOptions } from '@tanstack/react-query'
import { mergeAppendedFeed } from '@/domains/sessions/contract/model/wire/feed-contract'
import {
  type SessionContractError,
  throwSessionContractError,
  throwUnexpectedSessionReply,
} from '@/domains/sessions/renderer/session-contract-error'
import {
  SESSION_REFRESH_MS,
  sessionFeedQueryKey,
} from '@/domains/sessions/renderer/session-queries'
import type { SessionFeed, SessionId } from '@/domains/sessions/renderer/types'

export async function retrySessionFeed(
  queryClient: QueryClient,
  queryKey: QueryKey,
  refetch: () => Promise<unknown>,
) {
  await queryClient.cancelQueries({ queryKey })
  await refetch()
}

export function sessionFeedQuery(
  queryClient: QueryClient,
  sessionId: SessionId | null,
  subagentId: string | null,
): UseQueryOptions<SessionFeed | null, SessionContractError> {
  return {
    queryKey:
      sessionId === null
        ? ['sessions', 'feed', null, subagentId]
        : sessionFeedQueryKey(sessionId, subagentId),
    enabled: sessionId !== null,
    // A Feed belongs only to the active reader. Once its observer leaves on a Session switch,
    // React Query immediately drops the transcript and aborts its in-flight reader work. This
    // avoids an async manual cleanup that could race a rapid A -> B -> A switch.
    gcTime: 0,
    // A Harness writing this Session's transcript is what adds a row, and the watch on the transcript
    // trees reports that write, so the reader of this Feed subscribes to the topic rather than
    // re-reading the document twice a second. That poll cost the roster too: it re-rendered the whole
    // sidebar on every tick, 185291 renders in a 13-second idle recording.
    // A read that failed is the one case left with a timer: the reader is looking at an error, and
    // `retry: false` means nothing else will ask again until the next write. A failed read therefore
    // asks again at the old rate until one succeeds.
    refetchInterval: (query) => (query.state.error === null ? false : SESSION_REFRESH_MS),
    retry: false,
    queryFn: async ({ signal }) => {
      if (sessionId === null) return null
      const key = sessionFeedQueryKey(sessionId, subagentId)
      const cached = queryClient.getQueryData<SessionFeed>(key)
      // The abort TanStack Query fires on a query-key change (switching Sessions) or unmount
      // only stops the renderer from waiting on this promise; it does not reach the main
      // process, so the settle loop there keeps running a read nothing will draw (#2102). This
      // turns that local abort into the IPC call that actually stops it.
      const onAbort = () => void window.argo.cancelSessionFeed({ sessionId })
      signal.addEventListener('abort', onAbort)
      const reply = await window.argo
        .readSessionFeed({
          sessionId,
          subagentId,
          revision: cached?.revision ?? null,
        })
        .finally(() => signal.removeEventListener('abort', onAbort))
      switch (reply.type) {
        case 'session.feed.read':
          return reply
        // The server only sends this once it has seen this exact revision back from us, which
        // means the cached read it was built from is the one still in the query cache.
        case 'session.feed.appended':
          return mergeAppendedFeed(cached, reply)
        case 'session.feed.unchanged':
          return cached ?? null
        case 'session.error':
          return throwSessionContractError(reply)
        default:
          return throwUnexpectedSessionReply(reply)
      }
    },
  }
}
