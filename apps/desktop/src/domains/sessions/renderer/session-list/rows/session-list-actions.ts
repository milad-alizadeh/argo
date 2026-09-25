import type { Session, SessionId } from '../../types'

export type SessionListActions = {
  onArchiveSelected: (sessionIds: SessionId[]) => void
  onNew: () => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session, name: string) => Promise<string>
  onSelect: (sessionId: SessionId, retiredIds?: SessionId[]) => void
}
