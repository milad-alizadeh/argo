// Session rows the Sessions stories draw.
import type {
  SessionRow,
  SessionShellCommand,
  SessionSubagent,
} from '@/domains/sessions/renderer/model/models'
import { queryClient } from '@/platform/renderer/trpc-client'

function listedSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'session-one',
    retiredIds: [],
    harness: 'claude',
    posture: 'live',
    title: null,
    status: 'idle',
    entry: 'interactive',
    cwd: null,
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
  overrides: Partial<SessionRow> & Pick<SessionRow, 'id' | 'cwd' | 'posture' | 'status' | 'title'>,
): SessionRow {
  return listedSession({ branch: 'main', ...overrides })
}

export function sessionListTrpc(
  trpc: typeof window.argo.trpc,
  sessions: () => readonly SessionRow[],
): typeof window.argo.trpc {
  queryClient.removeQueries({ queryKey: ['sessions', 'list'] })
  return (async (request) => {
    if (request.path !== 'sessions.list') return trpc(request)
    const input = request.input as { page: number; pageSize: number }
    const rows = sessions()
    const start = (input.page - 1) * input.pageSize
    return {
      result: {
        data: {
          page: input.page,
          pageSize: input.pageSize,
          total: rows.length,
          rows: rows.slice(start, start + input.pageSize),
        },
      },
    }
  }) as typeof window.argo.trpc
}
