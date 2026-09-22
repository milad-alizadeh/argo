import { linkRow, stateIcon } from '@/domains/tickets/renderer/detail/ticket-detail-links'
import { TicketDetailSection } from '@/domains/tickets/renderer/detail/ticket-detail-section'
import type { LinkedSession } from '@/domains/tickets/renderer/hooks/use-linked-sessions'
import { Icon } from '@/platform/renderer/components/icon'

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
      icon={<Icon name="linked-sessions" className={stateIcon} />}
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
