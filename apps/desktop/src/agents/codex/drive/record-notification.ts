import type { SessionRosterRow } from '../../../core/sessions/models'
import { rollupSessionStatus } from '../../../core/sessions/session-status-rollup'
import { readCompletedCompaction, readStartedCompaction } from './compact-protocol'
import type { LiveMessages } from './live-messages'
import { codexManagedStatus } from './managed-status'
import type { WireMessage } from './protocol'
import { readCompletedTurn, readThreadStatus } from './protocol'
import type { PendingCodexQuestion } from './question-protocol'
import { readRequestUserInput } from './question-protocol'
import { readUpdatedThreadName } from './rename-protocol'

type HeldSession = {
  messages: LiveMessages
  status: SessionRosterRow['status']
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
  sessionId,
  sessions,
}: {
  acceptTitle: (title: string) => void
  message: WireMessage
  now: () => Date
  sessionId: string
  sessions: Map<string, HeldSession>
}): boolean {
  const session = sessions.get(sessionId)
  if (session === undefined) return false
  const question = readRequestUserInput(message)
  if (question?.threadId === sessionId) {
    session.pendingQuestion = question
    return true
  }
  if (session.messages.record(message)) return false
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
}) {
  const { now, renameWaiters, sessionId, sessions } = options
  return (message: WireMessage) =>
    recordCodexNotification({
      message,
      now,
      sessionId,
      sessions,
      acceptTitle: (title) => {
        renameWaiters.get(sessionId)?.(title)
        renameWaiters.delete(sessionId)
      },
    })
}
