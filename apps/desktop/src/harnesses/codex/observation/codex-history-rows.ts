import {
  managedRosterRow,
  type SessionFeedRow,
  sessionRosterRowSchema,
} from '@/domains/sessions/contract/model/models'
import type { TranscriptDiscovery } from '@/domains/sessions/main/observation/discover-transcript-sessions'
import type { SessionProjection } from '@/domains/sessions/next/contract/session-projection-contract'
import { reconcileStoredHistory } from '@/harnesses/codex/history/watched-projection'

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

export function rosterRowOf(projection: SessionProjection, cwd: string | null) {
  const prompt = promptOf(projection)
  const row = managedRosterRow({
    id: projection.session.nativeId,
    session: {
      harness: 'codex',
      cwd,
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
  return sessionRosterRowSchema.parse({
    ...row,
    posture: projection.posture === 'watched' ? 'watched' : 'managed',
    turnStartedAt: turnStartedAtOf(projection),
    updatedAt: startedAtOf(projection),
  })
}

export function rowsOf(projection: SessionProjection): SessionFeedRow[] {
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

export function discovery(
  projections: readonly SessionProjection[],
  checkoutFor: (nativeId: string) => string | null,
): TranscriptDiscovery {
  return {
    rows: projections.map((projection) =>
      rosterRowOf(projection, checkoutFor(projection.session.nativeId)),
    ),
    filesFound: 0,
    filesRead: 0,
    filesUnreadable: 0,
    filesParsed: 0,
    nextCursor: null,
    historyComplete: true,
  }
}

export function mergedProjections(
  stored: readonly SessionProjection[],
  live: readonly SessionProjection[],
): SessionProjection[] {
  const byId = new Map(stored.map((projection) => [projection.session.nativeId, projection]))
  for (const projection of live) {
    const previous = byId.get(projection.session.nativeId)
    byId.set(
      projection.session.nativeId,
      previous === undefined ? projection : reconcileStoredHistory(projection, previous),
    )
  }
  return [...byId.values()]
}

// Codex history comes from app-server. Rollout files never supply this source's content (#2581).
