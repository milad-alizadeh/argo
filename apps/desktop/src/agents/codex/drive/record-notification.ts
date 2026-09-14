import type { SessionRosterRow } from '../../../core/sessions/models'
import { rollupSessionStatus } from '../../../core/sessions/session-status-rollup'
import type { LiveMessages } from './live-messages'
import type { WireMessage } from './protocol'
import { readCompletedTurn, readThreadStatus } from './protocol'
import type { PendingCodexQuestion } from './question-protocol'
import { readRequestUserInput } from './question-protocol'
import { readUpdatedThreadName } from './rename-protocol'

type HeldSession = {
  messages: LiveMessages
  status: SessionRosterRow['status']
  title?: { text: string; source: 'custom' }
  pendingQuestion: PendingCodexQuestion | null
}

// Returns whether this notification was a server request this recorder claimed and will answer
// itself, so the channel does not also auto-refuse it (codex-channel.ts, #1841).
export function recordCodexNotification({
  acceptTitle,
  message,
  sessionId,
  sessions,
}: {
  acceptTitle: (title: string) => void
  message: WireMessage
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
    session.status = rollupSessionStatus('unknown', 'managed', {
      kind: 'codex',
      reading: { kind: 'thread', status: thread.status },
    })
    return false
  }
  const completed = readCompletedTurn(message)
  if (completed?.threadId === sessionId && completed.turn.status === 'failed') {
    session.status = rollupSessionStatus('unknown', 'managed', {
      kind: 'codex',
      reading: { kind: 'turn-failed' },
    })
  }
  return false
}

export function codexNotificationRecorder(
  sessionId: string,
  sessions: Map<string, HeldSession>,
  renameWaiters: Map<string, (title: string) => void>,
) {
  return (message: WireMessage) =>
    recordCodexNotification({
      message,
      sessionId,
      sessions,
      acceptTitle: (title) => {
        renameWaiters.get(sessionId)?.(title)
        renameWaiters.delete(sessionId)
      },
    })
}
