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
import type {
  SessionError,
  SessionExtras,
  SessionListResult,
  Session as SessionRow,
} from '@/domains/sessions/renderer/types'
import { queryClient, type RouterInputs, type RouterOutputs } from '@/platform/renderer/trpc-client'

type Subscribe = typeof window.argo.trpcSubscribe
type Trpc = typeof window.argo.trpc
// A story's rows may carry what the UI draws but no read reports yet.
type Session = SessionRow & SessionExtras

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

type SessionListRead = SessionListInput & { offset: number; limit: number }
type SessionUpdate = RouterInputs['sessionUpdate']

// One page of the rows in the order given; main alone sorts and searches.
export function storySessionPage(sessions: readonly Session[], read: SessionListRead) {
  const listed = sessions.filter(
    (session) => read.filter === 'all' || session.archived === (read.filter === 'archived'),
  )
  return { total: listed.length, rows: listed.slice(read.offset, read.offset + read.limit) }
}

type SessionHostOptions = {
  // Replaces the page read from the host's rows; a Session error answers as a failed read.
  list?: (read: SessionListRead) => Promise<SessionListResult | SessionError>
  // Says which IDs an update changed, or throws; the host applies those and announces them.
  update?: (update: SessionUpdate) => Promise<RouterOutputs['sessionUpdate']>
  // The recorded history every Feed of the story reads.
  feed?: FeedRead
  live?: readonly SessionLiveEvent[]
}

// Called, it restores the window and clears the query cache, so a story's `beforeEach` returns it.
export type SessionHost = (() => void) & {
  // Every Session List read and Session update the host answered, in order.
  reads: SessionListRead[]
  updates: SessionUpdate[]
  rows: () => readonly Session[]
  // Main stores each changed row, adding any new one, then announces the change.
  change: (changed: readonly Session[]) => void
}

// A read with main's defaults filled in, and no `ticketKey` unless the list sent one.
function listRead(input: Partial<SessionListRead>): SessionListRead {
  return {
    projectId: input.projectId ?? 'project-1',
    filter: input.filter ?? 'active',
    search: input.search ?? '',
    ...(input.ticketKey === undefined ? {} : { ticketKey: input.ticketKey }),
    offset: input.offset ?? 0,
    limit: input.limit ?? 30,
  }
}

// The rows an update changed, with its title and archive applied.
function updatedRows(rows: readonly Session[], input: SessionUpdate, sessionIds: string[]) {
  return rows
    .filter(({ id }) => sessionIds.includes(id))
    .map((row) => ({
      ...row,
      title:
        input.title === undefined ? row.title : { text: input.title, source: 'custom' as const },
      archived: input.archived ?? row.archived,
    }))
}

// Answers the sync subscription with the status a story last published, and the change
// subscription with each change the host announces.
function sessionSignals(
  next: Subscribe,
  changeReaders: Set<(sessionIds: string[]) => void>,
): Subscribe {
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
    if (request.path !== 'sessionListChanged') return next(request, listener)
    const send = (sessionIds: string[]) =>
      listener({ id: request.id, type: 'data', result: { data: { sessionIds } } })
    changeReaders.add(send)
    return () => changeReaders.delete(send)
  }
}

// The story's main process for Sessions: the list, details, updates, change and sync signals, and
// Feeds. Rows belong to whichever Project the list reads, copied as IPC would copy them.
export function installSessionHost(
  initial: readonly Session[],
  { list, update, feed, live }: SessionHostOptions = {},
): SessionHost {
  const before = window.argo
  queryClient.clear()
  syncStatus = IDLE_SYNC_STATUS
  let rows = [...initial]
  const reads: SessionListRead[] = []
  const updates: SessionUpdate[] = []
  const changeReaders = new Set<(sessionIds: string[]) => void>()
  const change = (changed: readonly Session[]) => {
    const fresh = changed.filter((row) => !rows.some(({ id }) => id === row.id))
    rows = [...rows.map((row) => changed.find(({ id }) => id === row.id) ?? row), ...fresh]
    const sessionIds = changed.map(({ id }) => id)
    for (const send of changeReaders) send(sessionIds)
  }
  const applyUpdate = async (input: SessionUpdate) => {
    updates.push(input)
    const known = rows.filter(({ id }) => input.sessionIds.includes(id)).map(({ id }) => id)
    const { sessionIds } = (await update?.(input)) ?? { sessionIds: known }
    change(updatedRows(rows, input, sessionIds))
    return { sessionIds }
  }
  const readList = async (input: Partial<SessionListRead>) => {
    const read = listRead(input)
    reads.push(read)
    const listed = rows.map((session) => ({ ...session, projectId: read.projectId }))
    return structuredClone(await (list?.(read) ?? storySessionPage(listed, read)))
  }
  const trpc = (async (request) => {
    switch (request.path) {
      case 'sessionList': {
        const page = await readList(request.input as Partial<SessionListRead>)
        return 'type' in page ? { error: { message: page.message } } : { result: { data: page } }
      }
      case 'sessionDetails': {
        const { sessionId } = request.input as { sessionId: string }
        await heldDetails.wait(sessionId)
        const session = rows.find(({ id }) => id === sessionId)
        return { result: { data: session === undefined ? null : structuredClone(session) } }
      }
      case 'sessionUpdate':
        return { result: { data: await applyUpdate(request.input as SessionUpdate) } }
      default:
        return before.trpc(request)
    }
  }) as Trpc
  const subscribe = sessionSignals(before.trpcSubscribe, changeReaders)
  window.argo = {
    ...before,
    trpc: sessionFeedRefreshTrpc(trpc),
    trpcSubscribe: feed === undefined ? subscribe : sessionFeedSubscribe(subscribe, feed, live),
  }
  const restore = () => {
    window.argo = before
    queryClient.clear()
  }
  return Object.assign(restore, { reads, updates, rows: () => rows, change })
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
function sessionFeedRefreshTrpc(next: typeof window.argo.trpc): typeof window.argo.trpc {
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
function sessionFeedSubscribe(
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
