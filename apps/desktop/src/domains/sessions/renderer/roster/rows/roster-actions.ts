import type { Session, SessionId } from '../../types'

export type RosterActions = {
  onArchiveSelected: (sessionIds: SessionId[]) => void
  onLinkTicket: (session: Session) => void
  onNew: () => void
  onOpenTicket: (session: Session) => void
  onRename: (session: Session, name: string) => Promise<string>
  onSelect: (sessionId: SessionId, retiredIds?: SessionId[]) => void
  onUnlinkTicket: (session: Session) => void
}
