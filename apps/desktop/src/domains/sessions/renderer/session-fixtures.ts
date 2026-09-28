// Session rows the Sessions stories draw.

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
    entry: 'interactive',
    cwd: null,
    workspaceId: null,
    branch: null,
    updatedAt: null,
    unreadableLines: 0,
    originUnread: false,
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

export function sessionFeedTrpc(
  trpc: typeof window.argo.trpc,
  read: (sessionId: string, subagentId: string | null) => Promise<SessionFeedSnapshot>,
): typeof window.argo.trpc {
  queryClient.removeQueries({ queryKey: ['sessions'] })
  return (async (request) => {
    if (request.path !== 'sessionFeedRead') return trpc(request)
    const input = request.input as { sessionId: string; subagentId: string | null }
    try {
      return { result: { data: await read(input.sessionId, input.subagentId) } }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const data =
        typeof error === 'object' && error !== null && 'data' in error
          ? (error as { data?: unknown }).data
          : undefined
      return { error: { code: -32004, message, data } }
    }
  }) as typeof window.argo.trpc
}
