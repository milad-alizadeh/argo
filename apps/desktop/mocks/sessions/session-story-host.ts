// Storybook host for the Session List query, its updates, change and sync subscriptions, and Feeds.

import { feedChainKey } from '@/domains/sessions/api/feed/feed-chain'
import { type FeedReading, feedReading } from '@/domains/sessions/api/feed/feed-reading'
import { feedEntryRows, projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import { feedSubagents, subagentCompletionRows } from '@/domains/sessions/api/feed/feed-subagents'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import type { SessionListInput } from '@/domains/sessions/renderer/session-list/session-list-query'
import type { SessionSyncStatus } from '@/domains/sessions/renderer/session-list/use-session-sync'
import type { Session, SessionError, SessionListResult } from '@/domains/sessions/renderer/types'
import { queryClient, type RouterInputs, type RouterOutputs } from '@/platform/renderer/trpc-client'

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

// Reads a story holds back by Session id until it releases them.
export function heldReads() {
  const held = new Map<string, () => void>()
  return {
    hold: (sessionId: string) => void held.set(sessionId, () => {}),
    // Settles at once for an id not held, else when the story releases it.
    wait: (sessionId: string) =>
      held.has(sessionId)
        ? new Promise<void>((resolve) => held.set(sessionId, resolve))
        : Promise.resolve(),
    release: (sessionId: string) => {
      const release = held.get(sessionId)
      held.delete(sessionId)
      release?.()
    },
    releaseAll: () => {
      for (const release of held.values()) release()
      held.clear()
    },
  }
}

export const heldDetails = heldReads()

// Answers a Session's details from the story's rows, found by ID as main reads them.
async function sessionDetailsReply(sessionId: string, sessions: () => readonly Session[]) {
  await heldDetails.wait(sessionId)
  const session = sessions().find(({ id }) => id === sessionId)
  return { result: { data: session === undefined ? null : structuredClone(session) } }
}

// Story rows belong to whichever Project the list last read, copied as IPC would copy them.
let listedProjectId = 'project-1'
const listedRows = (sessions: readonly Session[]) =>
  sessions.map((session) => ({ ...session, projectId: listedProjectId }))

const IDLE_SYNC_STATUS: SessionSyncStatus = {
  phase: 'idle',
  processed: 0,
  total: null,
  skipped: 0,
  lastSuccessfulSyncAt: null,
  failure: null,
}
let syncStatus = IDLE_SYNC_STATUS
const syncReaders = new Set<() => void>()

// Sends a History sync status to every open sync reader, as main's worker does.
export function publishSessionSyncStatus(status: Partial<SessionSyncStatus>) {
  syncStatus = { ...IDLE_SYNC_STATUS, ...status }
  for (const send of syncReaders) send()
}

// Answers the change subscription with every story row when a story announces one, and the sync
// subscription with the status a story last published.
export function sessionListSubscribe(
  subscribe: Subscribe,
  sessions: () => readonly Session[],
): Subscribe {
  queryClient.clear()
  syncStatus = IDLE_SYNC_STATUS
  return async (request, listener) => {
    if (request.path === 'sessionSyncStatus') {
      const send = () =>
        listener({
          id: request.id,
          type: 'data',
          result: { data: { type: 'status', status: syncStatus } },
        })
      syncReaders.add(send)
      send()
      return () => syncReaders.delete(send)
    }
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

export type SessionListRead = SessionListInput & { offset: number; limit: number }

// Main's list query over story rows: the filter, a search, and main's order.
export function storySessionPage(sessions: readonly Session[], input: SessionListRead) {
  const needle = input.search.trim().toLowerCase()
  const listed = sessions
    .toSorted(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        right.createdAt.localeCompare(left.createdAt) ||
        left.id.localeCompare(right.id),
    )
    .filter(
      (session) =>
        (input.filter === 'all' || session.archived === (input.filter === 'archived')) &&
        [session.customTitle, session.preview].some((text) =>
          (text ?? '').toLowerCase().includes(needle),
        ),
    )
  return { total: listed.length, rows: listed.slice(input.offset, input.offset + input.limit) }
}

type SessionListHost = {
  // Replaces the page read from the story rows; a Session error answers as a failed read.
  list?: (read: SessionListRead) => Promise<SessionListResult | SessionError>
  update?: (update: RouterInputs['sessionUpdate']) => Promise<RouterOutputs['sessionUpdate']>
}

// Answers the Session List query, `sessionUpdate` and `sessionDetails` from the story's rows.
export function sessionListTrpc(
  next: typeof window.argo.trpc,
  sessions: () => readonly Session[],
  { list, update }: SessionListHost = {},
): typeof window.argo.trpc {
  return (async (request) => {
    if (request.path === 'sessionDetails')
      return sessionDetailsReply((request.input as { sessionId: string }).sessionId, sessions)
    if (request.path === 'sessionUpdate' && update !== undefined)
      return { result: { data: await update(request.input as RouterInputs['sessionUpdate']) } }
    if (request.path !== 'sessionList') return next(request)
    const input = request.input as Partial<SessionListRead>
    listedProjectId = input.projectId ?? 'project-1'
    const read = {
      projectId: listedProjectId,
      filter: input.filter ?? 'active',
      search: input.search ?? '',
      offset: input.offset ?? 0,
      limit: input.limit ?? 30,
    }
    const page = await (list?.(read) ?? storySessionPage(listedRows(sessions()), read))
    if ('type' in page) return { error: { message: page.message } }
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
export function sessionFeedRefreshTrpc(next: typeof window.argo.trpc): typeof window.argo.trpc {
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
    return next(request)
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
