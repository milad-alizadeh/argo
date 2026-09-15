import { MessageSquare } from 'lucide-react'
import type { LinkedSession } from '../hooks/use-linked-sessions'
import { linkRow, stateIcon } from './ticket-detail-links'
import { TicketDetailSection } from './ticket-detail-section'

export function LinkedSessions({
  sessions,
  onOpenSession,
}: {
  sessions: readonly LinkedSession[]
  onOpenSession: (id: string) => void
}) {
  if (sessions.length === 0) return null
  return (
    <TicketDetailSection
      icon={<MessageSquare aria-hidden="true" className={stateIcon} />}
      title={`Linked Sessions · ${sessions.length}`}
    >
      <ul className="-mx-(--spacing-shell-item) grid grid-cols-[minmax(0,1fr)]">
        {sessions.map((session) => (
          <li key={session.id}>
            <button
              className={`${linkRow} hover:bg-muted`}
              onClick={() => onOpenSession(session.id)}
              type="button"
            >
              <span className="min-w-0 flex-1 truncate type-body">{session.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </TicketDetailSection>
  )
}
