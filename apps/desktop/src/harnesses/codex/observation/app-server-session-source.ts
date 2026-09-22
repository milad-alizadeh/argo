import { driveSessionError } from '@/domains/sessions/contract/ipc/contract'
import { managedRosterRow, type SessionFeedRow } from '@/domains/sessions/contract/model/models'
import type { SessionSource } from '@/domains/sessions/main/observation/session-source'
import type {
  SessionAdapter,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'

type AppServerDiscovery = {
  rows: ReturnType<typeof rosterRowOf>[]
  filesFound: number
  filesRead: number
  filesUnreadable: number
  filesParsed: number
  nextCursor: null
  historyComplete: true
}

function statusOf(projection: SessionProjection) {
  if (projection.sourceHealth === 'unavailable') return 'unknown' as const
  switch (projection.status) {
    case 'idle':
      return 'idle' as const
    case 'running':
      return 'running' as const
    case 'awaitingApproval':
      return 'permission' as const
    case 'awaitingAnswer':
      return 'asking' as const
  }
}

function startedAtOf(projection: SessionProjection): string {
  const startedAt = projection.turns.reduce<number | null>(
    (earliest, turn) =>
      earliest === null || turn.startedAt < earliest ? turn.startedAt : earliest,
    null,
  )
  return new Date(startedAt ?? 0).toISOString()
}

function promptOf(projection: SessionProjection): string {
  return projection.messages.find((message) => message.role === 'user')?.text ?? 'New Codex Session'
}

function turnStartedAtOf(projection: SessionProjection): string | null {
  const startedAt = projection.turns.reduce<number | null>(
    (latest, turn) => (latest === null || turn.startedAt > latest ? turn.startedAt : latest),
    null,
  )
  return startedAt === null ? null : new Date(startedAt).toISOString()
}

function rosterRowOf(projection: SessionProjection) {
  const prompt = promptOf(projection)
  const row = managedRosterRow({
    id: projection.session.nativeId,
    session: {
      harness: 'codex',
      cwd: null,
      prompt,
      setup: { model: null, effort: null, mode: null },
      startedAt: startedAtOf(projection),
      status: statusOf(projection),
      title: projection.title === null ? undefined : { text: projection.title, source: 'custom' },
      compactionPercentage: null,
      compactionStartedAt: null,
      compactionTokens: null,
      handoffFailure: null,
      handoffStartedAt: null,
    },
  })
  return { ...row, turnStartedAt: turnStartedAtOf(projection) }
}

function rowsOf(projection: SessionProjection): SessionFeedRow[] {
  const messages: SessionFeedRow[] = projection.messages.map((message) => ({
    shape: 'prose',
    id: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    text: message.text,
  }))
  const tools: SessionFeedRow[] = projection.toolCalls.map((tool) => ({
    shape: 'tool',
    id: tool.id,
    kind: 'tool',
    label: tool.name,
    lineCounts: null,
    status: tool.status === 'completed' ? 'succeeded' : tool.status,
    evidence: null,
    text: null,
  }))
  return [...messages, ...tools]
}

function discovery(projections: readonly SessionProjection[]): AppServerDiscovery {
  return {
    rows: projections.map(rosterRowOf),
    filesFound: 0,
    filesRead: 0,
    filesUnreadable: 0,
    filesParsed: 0,
    nextCursor: null,
    historyComplete: true,
  }
}

// The app-server is Codex's source of truth. This adapter is deliberately projection-only: no
// Codex transcript, process, event parser, or optimistic turn is recreated for the legacy reader.
export function createCodexAppServerSessionSource(options: {
  projections: () => readonly SessionProjection[]
  adapter: SessionAdapter
  fallback?: SessionSource
}): SessionSource & Required<Pick<SessionSource, 'rename'>> {
  const projectionFor = (sessionId: string) =>
    options.projections().find((projection) => projection.session.nativeId === sessionId) ?? null
  const fallback = options.fallback
  return {
    ...fallback,
    harness: 'codex',
    discoverSessions: async (request) => {
      const persisted =
        fallback === undefined ? discovery([]) : await fallback.discoverSessions(request)
      const rows = new Map(persisted.rows.map((row) => [row.id, row]))
      for (const row of discovery(options.projections()).rows) rows.set(row.id, row)
      return { ...persisted, rows: [...rows.values()] }
    },
    managedSessions: () => options.projections().map(rosterRowOf),
    readSessionFiles: fallback?.readSessionFiles ?? (async () => null),
    readManagedFeed: (sessionId) => {
      const projection = projectionFor(sessionId)
      if (projection === null) return undefined
      return {
        chainId: projection.session.nativeId,
        revision: String(projection.revision),
        rows: rowsOf(projection),
      }
    },
    readShellOutput: fallback?.readShellOutput ?? (async () => ({ state: 'absent' })),
    rename: async (request) => {
      if (projectionFor(request.sessionId) === null && fallback?.rename !== undefined) {
        return fallback.rename(request)
      }
      const outcome = await options.adapter.execute({
        type: 'session.rename',
        session: { harness: 'codex', nativeId: request.sessionId },
        title: request.name,
      })
      return outcome.kind === 'accepted'
        ? {
            version: 1,
            type: 'session.renamed',
            requestId: request.requestId,
            sessionId: request.sessionId,
            title: request.name,
          }
        : driveSessionError('not-drivable', 'codex', request.requestId)
    },
  }
}
