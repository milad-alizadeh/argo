import type { SessionRosterRow } from '@/core/sessions/models'
import type { LiveMessages } from './live-messages'
import type { WireMessage } from './protocol'
import { readCompletedTurn, readThreadStatus } from './protocol'
import { readUpdatedThreadName } from './rename-protocol'

type HeldSession = {
  messages: LiveMessages
  status: SessionRosterRow['status']
  title?: { text: string; source: 'custom' }
}

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
}): void {
  const session = sessions.get(sessionId)
  if (session === undefined || session.messages.record(message)) return
  const renamed = readUpdatedThreadName(message)
  if (renamed?.threadId === sessionId) {
    session.title = { text: renamed.title, source: 'custom' }
    acceptTitle(renamed.title)
    return
  }
  const status = readThreadStatus(message)
  if (status?.threadId === sessionId) {
    session.status = status.status
    return
  }
  const completed = readCompletedTurn(message)
  if (completed?.threadId === sessionId && completed.turn.status === 'failed') {
    session.status = 'unknown'
  }
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
