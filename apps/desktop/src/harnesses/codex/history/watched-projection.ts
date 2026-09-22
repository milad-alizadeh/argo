import type {
  SessionProjection,
  SessionStatus,
} from '@/domains/sessions/next/contract/session-projection-contract'
import type { StoredThread, VendorStatus } from './vendor-history'

function sessionStatus(status: VendorStatus): SessionStatus {
  switch (status.type) {
    case 'active':
      if (status.activeFlags?.includes('waitingOnApproval')) return 'awaitingApproval'
      if (status.activeFlags?.includes('waitingOnUserInput')) return 'awaitingAnswer'
      return 'running'
    case 'idle':
    case 'notLoaded':
    case 'systemError':
    case 'unknown':
      return 'idle'
  }
}

function millisOf(value: number | null): number {
  if (value === null) return 0
  return value < 10_000_000_000 ? value * 1000 : value
}

export function matchWorkspace(
  cwd: string | null,
  known: readonly { id: string; path: string }[],
): { id: string } | null {
  if (cwd === null) return null
  const workspace = known.find((candidate) => candidate.path === cwd)
  return workspace === undefined ? null : { id: workspace.id }
}

export function projectionFromStoredThread(
  thread: StoredThread,
  workspace: { id: string } | null,
  details: { revision: number; sourceHealth?: SessionProjection['sourceHealth'] },
): SessionProjection {
  const sourceHealth = details.sourceHealth ?? 'ready'
  const revision = details.revision
  const updatedAt = millisOf(thread.updatedAt)
  return {
    session: { harness: 'codex', nativeId: thread.id },
    posture: 'watched',
    sourceHealth: thread.status.type === 'systemError' ? 'unavailable' : sourceHealth,
    revision,
    workspace,
    status: sessionStatus(thread.status),
    title: thread.title,
    turns: thread.turns.map((turn) => ({
      id: turn.id,
      status: turn.status,
      startedAt: millisOf(turn.startedAt),
      completedAt: turn.status === 'running' ? null : updatedAt,
    })),
    messages: thread.turns.flatMap((turn) =>
      turn.items
        .filter((item) => item.role !== 'tool')
        .map((item) => ({
          id: item.id,
          turnId: turn.id,
          role: item.role === 'user' ? ('user' as const) : ('agent' as const),
          text: item.text,
        })),
    ),
    toolCalls: thread.turns.flatMap((turn) =>
      turn.items
        .filter((item) => item.role === 'tool')
        .map((item) => ({
          id: item.id,
          turnId: turn.id,
          name: item.name,
          status: item.status,
        })),
    ),
    pendingApprovals: [],
    pendingQuestions: [],
    usage: { inputTokens: 0, outputTokens: 0 },
  }
}

export function reconcileStoredHistory(
  live: SessionProjection,
  stored: SessionProjection,
): SessionProjection {
  const merge = <Value extends { id: string }>(
    storedValues: readonly Value[],
    liveValues: readonly Value[],
  ): Value[] => {
    const liveById = new Map(liveValues.map((value) => [value.id, value]))
    const storedIds = new Set(storedValues.map((value) => value.id))
    return [
      ...storedValues.map((value) => liveById.get(value.id) ?? value),
      ...liveValues.filter((value) => !storedIds.has(value.id)),
    ]
  }
  return {
    ...live,
    title: live.title ?? stored.title,
    turns: merge(stored.turns, live.turns),
    messages: merge(stored.messages, live.messages),
    toolCalls: merge(stored.toolCalls, live.toolCalls),
  }
}
