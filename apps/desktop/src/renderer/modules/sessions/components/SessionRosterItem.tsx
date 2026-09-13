import type { Session } from '../types'

const STATUS_MARKS: Record<Session['status'], string> = {
  asking: 'bg-warn',
  ended: 'bg-danger',
  idle: 'bg-idle',
  permission: 'bg-warn',
  running: 'bg-active shadow-state-glow',
  starting: 'bg-active shadow-state-glow',
  stopped: 'bg-danger',
  unknown: 'bg-transparent shadow-state-outline',
}

function activitySummary(session: Session): string {
  if (session.activity === null) return session.status
  return [session.activity.tool, session.activity.target].filter(Boolean).join(' ')
}

function sessionMetadata(session: Session): string[] {
  const metadata = [session.cli]
  if (session.plan !== null) metadata.push(`${session.plan.completed}/${session.plan.total} steps`)
  if (session.delegations.length > 0) metadata.push(`${session.delegations.length} agents`)
  if (session.pullRequest !== null) metadata.push(`PR #${session.pullRequest.number}`)
  return metadata
}

function sessionName(session: Session): string {
  return session.title?.text ?? session.id
}

export function SessionRosterItem({
  onFocus,
  onSelect,
  selected,
  session,
  tabIndex,
}: {
  onFocus: () => void
  onSelect: () => void
  selected: boolean
  session: Session
  tabIndex: number
}) {
  return (
    <li>
      <button
        aria-current={selected ? 'page' : undefined}
        className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-muted text-foreground' : ''}`}
        data-session-id={session.id}
        onClick={onSelect}
        onFocus={onFocus}
        tabIndex={tabIndex}
        type="button"
      >
        <span className="flex items-start gap-tight">
          <span
            aria-hidden="true"
            className={`mt-(--spacing-dot-inset) size-(--size-state-dot) shrink-0 rounded-full ${STATUS_MARKS[session.status]}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{sessionName(session)}</span>
            <span className="block truncate text-meta text-faint">{activitySummary(session)}</span>
            <span className="block truncate font-mono text-meta text-faint">
              {sessionMetadata(session).join(' · ')}
            </span>
          </span>
        </span>
      </button>
    </li>
  )
}
