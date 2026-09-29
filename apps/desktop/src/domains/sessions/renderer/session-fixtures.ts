// Session rows the Sessions stories draw.

import { feedChainKey } from '@/domains/sessions/api/feed/feed-chain'
import { type FeedReading, feedReading } from '@/domains/sessions/api/feed/feed-reading'
import { feedEntryRows, projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import { feedSubagents, subagentCompletionRows } from '@/domains/sessions/api/feed/feed-subagents'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import type { SessionShellCommand, SessionSubagent } from '@/domains/sessions/renderer/model/models'
import { DEFAULT_HARNESS } from '@/harnesses/harness'
import { queryClient } from '@/platform/renderer/trpc-client'
import { sessionRosterPathKey } from './session-list/session-roster'
import type { Session, SessionFeedSnapshot } from './types'

function listedSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-one',
    retiredIds: [],
    harness: DEFAULT_HARNESS,
    posture: 'live',
    customTitle: null,
    preview: null,
    title: null,
    status: 'idle',
    cwd: null,
    workspaceId: null,
    branch: null,
    updatedAt: null,
    turnStartedAt: null,
    activity: null,
    plan: null,
    subagents: [],
    shell: [],
    pullRequest: null,
    ticket: null,
    archived: false,
    unread: false,
    turnConfiguration: { model: null, effort: null, mode: null },
    ...overrides,
  }
}

export function sessionShellCommand(
  overrides: Partial<SessionShellCommand> & Pick<SessionShellCommand, 'id'>,
): SessionShellCommand {
  return {
    command: null,
    label: null,
    background: false,
    state: 'running',
    startedAt: null,
    endedAt: null,
    outputPath: null,
    result: null,
    ...overrides,
  }
}

export function sessionSubagent(
  overrides: Partial<SessionSubagent> & Pick<SessionSubagent, 'id'>,
): SessionSubagent {
  return { label: null, state: 'running', startedAt: null, endedAt: null, ...overrides }
}

export function sessionRow(
  overrides: Partial<Session> & Pick<Session, 'id' | 'cwd' | 'posture' | 'status' | 'title'>,
): Session {
  return listedSession({ branch: 'main', ...overrides })
}

type Subscribe = typeof window.argo.trpcSubscribe
const openRosters = new Set<() => void>()

// Sends every open story roster its rows again, as the main process does after a change.
export function announceSessionListChange() {
  for (const send of openRosters) send()
}

export function sessionListSubscribe(
  subscribe: Subscribe,
  sessions: () => readonly Session[],
): Subscribe {
  queryClient.removeQueries({ queryKey: sessionRosterPathKey })
  return async (request, listener) => {
    if (request.path !== 'sessionList') return subscribe(request, listener)
    const input = request.input as { pages?: number; pageSize?: number }
    const pages = input.pages ?? 1
    const pageSize = input.pageSize ?? 30
    const send = () => {
      const rows = sessions()
      listener({
        id: request.id,
        type: 'data',
        result: {
          data: {
            type: 'list',
            pages,
            pageSize,
            total: rows.length,
            rows: rows.slice(0, pages * pageSize),
          },
        },
      })
    }
    openRosters.add(send)
    queueMicrotask(send)
    return () => openRosters.delete(send)
  }
}

type FeedRead = (sessionId: string, subagentId: string | null) => Promise<SessionFeedSnapshot>
const openFeeds = new Map<string, Set<() => void>>()

function readFailure(error: unknown): { message: string; data?: { code?: unknown } } {
  const data =
    typeof error === 'object' && error !== null && 'data' in error
      ? (error as { data?: { code?: unknown } }).data
      : undefined
  return { message: error instanceof Error ? error.message : String(error), data }
}

// Answers the Feed read, and the root Feed's Refresh, from one story history.
export function sessionFeedTrpc(
  trpc: typeof window.argo.trpc,
  read: FeedRead,
): typeof window.argo.trpc {
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
    if (request.path !== 'sessionFeedRead') return trpc(request)
    const input = request.input as { sessionId: string; subagentId: string | null }
    try {
      return { result: { data: await read(input.sessionId, input.subagentId) } }
    } catch (error) {
      return { error: { code: -32004, ...readFailure(error) } }
    }
  }) as typeof window.argo.trpc
}

// A chain's rows as main projects them; a Subagent's end with its parent's responses for it.
async function chainEntries(
  read: FeedRead,
  chain: { sessionId: string; subagentId: string | null },
  live: readonly SessionLiveEvent[],
) {
  const snapshot = await read(chain.sessionId, chain.subagentId)
  if (chain.subagentId === null)
    return projectFeedRowEntries({ history: snapshot.content, live }).entries
  const parent = await read(chain.sessionId, null)
  const parentRows = feedEntryRows(projectFeedRowEntries({ history: parent.content, live }).entries)
  return projectFeedRowEntries({
    history: snapshot.content,
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
    const status = live.findLast((event) => event.type === 'status')
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
            liveStatus: subagentId === null && status?.type === 'status' ? status.status : null,
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
