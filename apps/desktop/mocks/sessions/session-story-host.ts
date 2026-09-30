// Storybook host for the Session List query, its change subscription and Feed subscriptions.

import { feedChainKey } from '@/domains/sessions/api/feed/feed-chain'
import { type FeedReading, feedReading } from '@/domains/sessions/api/feed/feed-reading'
import { feedEntryRows, projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import { feedSubagents, subagentCompletionRows } from '@/domains/sessions/api/feed/feed-subagents'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import {
  type SessionListInput,
  sessionListPathKey,
} from '@/domains/sessions/renderer/session-list/session-list-query'
import { sessionDetailsPathKey } from '@/domains/sessions/renderer/session-queries'
import type { Session } from '@/domains/sessions/renderer/types'
import { queryClient } from '@/platform/renderer/trpc-client'

type Subscribe = typeof window.argo.trpcSubscribe
const openReaders = new Set<() => void>()

// Announces every story row to each open change reader, as main does after a change.
export function announceSessionListChange() {
  for (const send of openReaders) send()
}

export function announceSessionFeedChange() {
  for (const feeds of openFeeds.values()) {
    for (const refresh of feeds) refresh()
  }
}

// Details reads the story holds back until it releases them, by Session id.
const heldDetails = new Map<string, () => void>()

export function holdSessionDetails(sessionId: string) {
  heldDetails.set(sessionId, () => {})
}

export function forgetHeldSessionDetails() {
  heldDetails.clear()
}

export function releaseSessionDetails(sessionId: string) {
  const release = heldDetails.get(sessionId)
  heldDetails.delete(sessionId)
  release?.()
}

// Answers a Session's details from the story's rows, found by ID as main reads them.
function sessionDetailsReply(sessionId: string, sessions: () => readonly Session[]) {
  const reply = () => {
    const session = sessions().find(({ id }) => id === sessionId)
    return { result: { data: session === undefined ? null : structuredClone(session) } }
  }
  if (!heldDetails.has(sessionId)) return Promise.resolve(reply())
  return new Promise<ReturnType<typeof reply>>((resolve) =>
    heldDetails.set(sessionId, () => resolve(reply())),
  )
}

// Story rows belong to whichever Project the list last read, copied as IPC would copy them.
let listedProjectId = 'project-1'
const listedRows = (sessions: readonly Session[]) =>
  sessions.map((session) => ({ ...session, projectId: listedProjectId }))

// Answers the Session List's change subscription with every story row whenever a story announces one.
export function sessionListSubscribe(
  subscribe: Subscribe,
  sessions: () => readonly Session[],
): Subscribe {
  queryClient.removeQueries({ queryKey: sessionListPathKey })
  queryClient.removeQueries({ queryKey: sessionDetailsPathKey })
  return async (request, listener) => {
    if (request.path !== 'sessionListChanged') return subscribe(request, listener)
    const send = () =>
      listener({
        id: request.id,
        type: 'data',
        result: { data: { sessionIds: sessions().map(({ id }) => id) } },
      })
    openReaders.add(send)
    return () => openReaders.delete(send)
  }
}

// Main's list query over story rows: one Project, the filter, a search, and lower sort order first.
export function storySessionPage(
  sessions: readonly Session[],
  input: SessionListInput & { offset: number; limit: number },
) {
  const needle = input.search.trim().toLowerCase()
  const listed = sessions
    .toSorted((left, right) => left.sortOrder - right.sortOrder)
    .filter(
      (session) =>
        session.projectId === input.projectId &&
        (input.filter === 'all' || session.archived === (input.filter === 'archived')) &&
        [session.customTitle, session.preview].some((text) =>
          (text ?? '').toLowerCase().includes(needle),
        ),
    )
  return { total: listed.length, rows: listed.slice(input.offset, input.offset + input.limit) }
}

// Answers one page of the Session List query from the story's rows, in the story's order.
export function sessionListTrpc(
  trpc: typeof window.argo.trpc,
  sessions: () => readonly Session[],
): typeof window.argo.trpc {
  return (async (request) => {
    if (request.path === 'sessionDetails')
      return sessionDetailsReply((request.input as { sessionId: string }).sessionId, sessions)
    if (request.path !== 'sessionList') return trpc(request)
    const input = request.input as Partial<SessionListInput> & { offset?: number; limit?: number }
    listedProjectId = input.projectId ?? 'project-1'
    const page = storySessionPage(listedRows(sessions()), {
      projectId: listedProjectId,
      filter: input.filter ?? 'active',
      search: input.search ?? '',
      offset: input.offset ?? 0,
      limit: input.limit ?? 30,
    })
    return { result: { data: page } }
  }) as typeof window.argo.trpc
}

// A story's recorded vendor history for one chain, the same input main's reader takes.
export type FeedRead = (
  sessionId: string,
  subagentId: string | null,
) => Promise<readonly FeedContent[]>
const openFeeds = new Map<string, Set<() => void>>()

function readFailure(error: unknown): { message: string; data?: { code?: unknown } } {
  const data =
    typeof error === 'object' && error !== null && 'data' in error
      ? (error as { data?: { code?: unknown } }).data
      : undefined
  return { message: error instanceof Error ? error.message : String(error), data }
}

// Answers the root Feed's Refresh by reading every open story Feed again.
export function sessionFeedRefreshTrpc(trpc: typeof window.argo.trpc): typeof window.argo.trpc {
  queryClient.removeQueries({ queryKey: ['sessions'] })
  return (async (request) => {
    if (request.path === 'sessionFeedRefresh') {
      const input = request.input as { sessionId: string; subagentId?: string | null }
      const feeds =
        openFeeds.get(
          feedChainKey({ sessionId: input.sessionId, subagentId: input.subagentId ?? null }),
        ) ?? new Set()
      for (const refresh of feeds) refresh()
      return { result: { data: { accepted: feeds.size > 0 } } }
    }
    return trpc(request)
  }) as typeof window.argo.trpc
}

// A chain's rows as main projects them; a Subagent's end with its parent's responses for it.
async function chainEntries(
  read: FeedRead,
  chain: { sessionId: string; subagentId: string | null },
  live: readonly SessionLiveEvent[],
) {
  const history = await read(chain.sessionId, chain.subagentId)
  if (chain.subagentId === null) return projectFeedRowEntries({ history, live }).entries
  const parent = await read(chain.sessionId, null)
  const parentRows = feedEntryRows(projectFeedRowEntries({ history: parent, live }).entries)
  return projectFeedRowEntries({
    history,
    live: [],
    end: subagentCompletionRows(parentRows, chain.subagentId),
  }).entries
}

// A chain's readings, as the main reader publishes them: loading, then each read's result,
// keeping the rows a failed read already had.
export function sessionFeedSubscribe(
  subscribe: Subscribe,
  read: FeedRead,
  live: readonly SessionLiveEvent[] = [],
): Subscribe {
  return async (request, listener) => {
    if (request.path !== 'sessionFeed') return subscribe(request, listener)
    const input = request.input as { sessionId: string; subagentId?: string | null }
    const { sessionId } = input
    const subagentId = input.subagentId ?? null
    let entries: FeedReading['entries'] = []
    let reads = 0
    let open = true
    const send = (state: FeedReading['state'], error: FeedReading['error']) =>
      listener({
        id: request.id,
        type: 'data',
        result: {
          data: feedReading({
            sessionId,
            chainId: subagentId ?? sessionId,
            state,
            error,
            pendingPermissionId: null,
            liveStatus:
              subagentId === null
                ? (live.findLast((event) => event.type === 'status')?.status ?? null)
                : null,
            entries,
            subagents: subagentId === null ? feedSubagents(feedEntryRows(entries)) : [],
          }),
        },
      })
    const refresh = () => {
      const current = ++reads
      chainEntries(read, { sessionId, subagentId }, live).then(
        (projected) => {
          if (!open || current !== reads) return
          entries = projected
          send('ready', null)
        },
        (error: unknown) => {
          if (!open || current !== reads) return
          const missing = readFailure(error).data?.code === 'NOT_FOUND'
          send(
            'failed',
            sessionError(missing ? 'missing-session' : 'vendor-history-unavailable', null),
          )
        },
      )
    }
    const key = feedChainKey({ sessionId, subagentId })
    const feeds = openFeeds.get(key) ?? new Set()
    feeds.add(refresh)
    openFeeds.set(key, feeds)
    queueMicrotask(() => {
      send('loading', null)
      refresh()
    })
    return () => {
      open = false
      feeds.delete(refresh)
    }
  }
}
