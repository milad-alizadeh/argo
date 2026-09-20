import type { SessionPlan, SessionRosterRow } from '@/domains/sessions/contract/model/models'
import { rollupSessionStatus } from '@/domains/sessions/main/port'
import {
  readCompletedCompaction,
  readStartedCompaction,
} from '@/harnesses/codex/drive/compact-protocol'
import type { LiveMessages } from '@/harnesses/codex/drive/live-messages'
import { codexManagedStatus } from '@/harnesses/codex/drive/managed-status'
import { readUpdatedPlan } from '@/harnesses/codex/drive/plan-protocol'
import type { WireMessage } from '@/harnesses/codex/drive/protocol'
import { readCompletedTurn, readThreadStatus } from '@/harnesses/codex/drive/protocol'
import type { PendingCodexQuestion } from '@/harnesses/codex/drive/question-protocol'
import { readRequestUserInput } from '@/harnesses/codex/drive/question-protocol'
import { readUpdatedThreadName } from '@/harnesses/codex/drive/rename-protocol'

export type HeldSession = {
  messages: LiveMessages
  plan: SessionPlan | null
  status: SessionRosterRow['status']
  turnId: string | null
  compactionStartedAt: string | null
  title?: { text: string; source: 'custom' }
  pendingQuestion: PendingCodexQuestion | null
}

// Returns whether this notification was a server request this recorder claimed and will answer
// itself, so the channel does not also auto-refuse it (codex-channel.ts, #1841).
export function recordCodexNotification({
  acceptTitle,
  message,
  now,
  onPlanUpdated,
  sessionId,
  sessions,
}: {
  acceptTitle: (title: string) => void
  message: WireMessage
  now: () => Date
  onPlanUpdated: () => void
  sessionId: string
  sessions: Map<string, HeldSession>
}): boolean {
  const session = sessions.get(sessionId)
  if (session === undefined) return false
  const question = readRequestUserInput(message)
  if (question?.threadId === sessionId) {
    session.pendingQuestion = question
    if (session.status === 'running') session.status = 'asking'
    return true
  }
  if (session.messages.record(message)) return false
  const updatedPlan = readUpdatedPlan(message)
  if (updatedPlan !== undefined) {
    session.plan = updatedPlan
    onPlanUpdated()
  }
  const renamed = readUpdatedThreadName(message)
  if (renamed?.threadId === sessionId) {
    session.title = { text: renamed.title, source: 'custom' }
    acceptTitle(renamed.title)
    return false
  }
  // No transcript floor participates in a live managed reading, so `unknown` — the honest
  // "nothing observed" floor — leaves the protocol's own signal standing unopposed.
  const thread = readThreadStatus(message)
  if (thread?.threadId === sessionId) {
    session.status = rollupSessionStatus(
      'unknown',
      'managed',
      codexManagedStatus({ kind: 'thread', status: thread.status }),
    )
    return false
  }
  const completed = readCompletedTurn(message)
  if (completed?.threadId === sessionId && completed.turn.status === 'failed') {
    session.status = rollupSessionStatus(
      'unknown',
      'managed',
      codexManagedStatus({ kind: 'turn-failed' }),
    )
    return false
  }
  // A compaction Argo requested already holds its start; an automatic one starts here.
  if (readStartedCompaction(message)?.threadId === sessionId)
    session.compactionStartedAt ??= now().toISOString()
  if (readCompletedCompaction(message)?.threadId === sessionId) session.compactionStartedAt = null
  return false
}

export function codexNotificationRecorder(options: {
  sessionId: string
  sessions: Map<string, HeldSession>
  renameWaiters: Map<string, (title: string) => void>
  now: () => Date
  onPlanUpdated: () => void
}) {
  const { now, onPlanUpdated, renameWaiters, sessionId, sessions } = options
  return (message: WireMessage) =>
    recordCodexNotification({
      message,
      now,
      onPlanUpdated,
      sessionId,
      sessions,
      acceptTitle: (title) => {
        renameWaiters.get(sessionId)?.(title)
        renameWaiters.delete(sessionId)
      },
    })
}
