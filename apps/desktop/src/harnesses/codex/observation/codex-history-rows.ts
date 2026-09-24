import {
  managedRosterRow,
  type SessionFeedRow,
  sessionRosterRowSchema,
} from '@/domains/sessions/contract/model/models'
import type { TranscriptDiscovery } from '@/domains/sessions/main/observation/reader/discover-transcript-sessions'
import type { SessionProjection } from '@/domains/sessions/next/contract/session-projection-contract'
import { reconcileStoredHistory } from '../history/watched-projection'

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

function promptOf(projection: SessionProjection): string {
  return projection.messages.find((message) => message.role === 'user')?.text ?? ''
}

function validTimestamp(timestamp: number): boolean {
  return (
    Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(new Date(timestamp).getTime())
  )
}

function timestampsOf(projection: SessionProjection) {
  if (projection.turns.length === 0) return { startedAt: null, turnStartedAt: null }
  let first = Number.POSITIVE_INFINITY
  let last = Number.NEGATIVE_INFINITY
  for (const turn of projection.turns) {
    if (!validTimestamp(turn.startedAt)) return { startedAt: null, turnStartedAt: null }
    first = Math.min(first, turn.startedAt)
    last = Math.max(last, turn.startedAt)
  }
  return { startedAt: new Date(first).toISOString(), turnStartedAt: new Date(last).toISOString() }
}

function relayOutput(projection: SessionProjection, prompt: string): boolean {
  return (
    projection.title?.trimStart().startsWith('AGENT OUTPUT:') === true ||
    prompt.trimStart().startsWith('AGENT OUTPUT:')
  )
}

type RosterIssue = 'missingTitle' | 'invalidTimestamp' | 'relayOutput'

const BOUNDARY_REPORT_INTERVAL_MS = 30_000
let lastBoundaryReportAt = Number.NEGATIVE_INFINITY

function rosterIssues(
  projection: SessionProjection,
  prompt: string,
  timestamps: ReturnType<typeof timestampsOf>,
): RosterIssue[] {
  const issues: RosterIssue[] = []
  if (!(projection.title?.trim() || prompt.trim())) issues.push('missingTitle')
  if (timestamps.startedAt === null) issues.push('invalidTimestamp')
  if (relayOutput(projection, prompt)) issues.push('relayOutput')
  return issues
}

function rowFrom(options: {
  projection: SessionProjection
  cwd: string | null
  prompt: string
  timestamps: ReturnType<typeof timestampsOf>
}) {
  const { projection, cwd, prompt, timestamps } = options
  const row = managedRosterRow({
    id: projection.session.nativeId,
    session: {
      harness: 'codex',
      cwd,
      prompt,
      setup: { model: null, effort: null, mode: null },
      startedAt: timestamps.startedAt,
      status: statusOf(projection),
      title: projection.title?.trim()
        ? { text: projection.title, source: 'custom' as const }
        : undefined,
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
    turnStartedAt: timestamps.turnStartedAt,
    updatedAt: timestamps.turnStartedAt,
  })
}

export function rosterRows(
  projections: readonly SessionProjection[],
  checkoutFor: (nativeId: string) => string | null,
) {
  const inspected = projections.map((projection) => {
    const prompt = promptOf(projection)
    const timestamps = timestampsOf(projection)
    const issues = rosterIssues(projection, prompt, timestamps)
    return {
      issues,
      row:
        !issues.includes('missingTitle') && !issues.includes('relayOutput')
          ? rowFrom({
              projection,
              cwd: checkoutFor(projection.session.nativeId),
              prompt,
              timestamps,
            })
          : null,
    }
  })
  const counts = {
    missingTitle: inspected.filter(({ issues }) => issues.includes('missingTitle')).length,
    invalidTimestamp: inspected.filter(({ issues }) => issues.includes('invalidTimestamp')).length,
    relayOutput: inspected.filter(({ issues }) => issues.includes('relayOutput')).length,
  }
  const unreadable = inspected.filter(({ issues }) => issues.length > 0).length
  const now = Date.now()
  if (unreadable > 0 && now - lastBoundaryReportAt >= BOUNDARY_REPORT_INTERVAL_MS) {
    console.warn('Codex app-server Session records have boundary issues', { unreadable, ...counts })
    lastBoundaryReportAt = now
  }
  return { rows: inspected.flatMap(({ row }) => (row === null ? [] : [row])), unreadable }
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
  const roster = rosterRows(projections, checkoutFor)
  return {
    rows: roster.rows,
    filesFound: projections.length,
    filesRead: projections.length,
    filesUnreadable: roster.unreadable,
    filesParsed: roster.rows.length,
    nextCursor: null,
    historyComplete: roster.unreadable === 0,
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
