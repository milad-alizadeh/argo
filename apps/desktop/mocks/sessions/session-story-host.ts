// Storybook host for Session roster and Feed subscriptions.

import { feedChainKey } from '@/domains/sessions/api/feed/feed-chain'
import { type FeedReading, feedReading } from '@/domains/sessions/api/feed/feed-reading'
import { feedEntryRows, projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import { feedSubagents, subagentCompletionRows } from '@/domains/sessions/api/feed/feed-subagents'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import { sessionListWindowPathKey } from '@/domains/sessions/renderer/session-list/session-list-window'
import { sessionDetailsPathKey } from '@/domains/sessions/renderer/session-queries'
import type { Session, SessionListWindow } from '@/domains/sessions/renderer/types'
import type { RouterInputs } from '@/platform/renderer/trpc-client'
import { queryClient } from '@/platform/renderer/trpc-client'

type Subscribe = typeof window.argo.trpcSubscribe
const openReaders = new Set<() => void>()

// Sends every open story roster and details reader its rows again, as main does after a change.
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
function sessionDetailsReply(
  request: Parameters<Subscribe>[0],
  listener: Parameters<Subscribe>[1],
  sessions: () => readonly Session[],
) {
  const { sessionId } = request.input as { sessionId: string }
  let open = true
  // A held reply is already in flight, so it arrives even after the reader closes.
  const reply = () => {
    const session = sessions().find(({ id }) => id === sessionId)
    const details = session === undefined ? null : { projectId: 'project-1', ...session }
    listener({ id: request.id, type: 'data', result: { data: { sessionId, details } } })
  }
  const send = () => {
    if (!open) return
    if (heldDetails.has(sessionId)) heldDetails.set(sessionId, reply)
    else reply()
  }
  openReaders.add(send)
  queueMicrotask(send)
  return Promise.resolve(() => {
    open = false
    openReaders.delete(send)
  })
}

type WindowInput = Pick<RouterInputs['sessionListWindow'], 'anchor' | 'before' | 'after'>

// The window main would read from `rows`, taken in the order given.
export function sessionListWindowOf(
  rows: readonly Session[],
  input: WindowInput,
): SessionListWindow {
  const before = input.before ?? 0
  const after = input.after ?? 30
  const last = Math.max(rows.length - 1, 0)
  const { anchor } = input
  const found = anchor.kind === 'key' ? rows.findIndex((row) => row.id === anchor.id) : -1
  const position = {
    start: 0,
    end: last,
    index: anchor.kind === 'index' ? Math.min(anchor.index, last) : 0,
    key: found === -1 ? 0 : found,
  }[anchor.kind]
  const offset = anchor.kind === 'start' ? 0 : Math.max(position - before, 0)
  return {
    total: rows.length,
    offset,
    rows: rows.slice(offset, position + after),
  }
}

// The rows the story's list host serves, read by the base Storybook `sessionListWindow` handler.
let listedSessions: () => readonly Session[] = () => []

export function storySessionListWindow(input: WindowInput): SessionListWindow {
  return sessionListWindowOf(listedSessions(), input)
}

// Serves `sessions` as the Session List, and tells every open list view to read again whenever the
// story announces a change.
export function sessionListSubscribe(
  subscribe: Subscribe,
  sessions: () => readonly Session[],
): Subscribe {
  queryClient.removeQueries({ queryKey: sessionListWindowPathKey })
  queryClient.removeQueries({ queryKey: sessionDetailsPathKey })
  listedSessions = sessions
  return async (request, listener) => {
    if (request.path === 'sessionDetails') return sessionDetailsReply(request, listener, sessions)
    if (request.path !== 'sessionListChanges') return subscribe(request, listener)
    const send = () =>
      listener({ id: request.id, type: 'data', result: { data: { type: 'invalidated' } } })
    openReaders.add(send)
    queueMicrotask(send)
    return () => openReaders.delete(send)
  }
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
