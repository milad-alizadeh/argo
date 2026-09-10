import type { Session, SessionId } from '../types'

import { SessionListItem } from './SessionListItem'

type SessionListProps = { sessions: readonly Session[]; selectedSessionId: SessionId | null; onSelect: (sessionId: SessionId) => void }

export function SessionList({ sessions, selectedSessionId, onSelect }: SessionListProps) {
  return <nav aria-label="Sessions" className="divide-y divide-rule/70">{sessions.map((session) => <SessionListItem key={session.id} onSelect={onSelect} selected={session.id === selectedSessionId} session={session} />)}</nav>
}
