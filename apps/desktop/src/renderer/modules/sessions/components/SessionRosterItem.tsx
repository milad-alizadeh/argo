import { Bot } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '@/renderer/components/ui/context-menu'
import type { Session } from '../types'
import { SessionReferenceText } from './SessionReference'

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

function SessionMetadata({ session }: { session: Session }) {
  const completed =
    session.plan?.state === 'available'
      ? `${session.plan.entries.filter((entry) => entry.status === 'completed').length}/${session.plan.entries.length} steps`
      : null
  return (
    <span className="flex items-center gap-1 truncate font-mono text-meta text-faint">
      <span>{session.cli}</span>
      {completed === null ? null : <span>{completed}</span>}
      {session.plan?.state === 'malformed' ? <span>Plan unreadable</span> : null}
      {session.delegations.length > 0 ? (
        <span className="inline-flex">
          <Bot aria-hidden="true" className="size-3" />
          <span className="sr-only">{session.delegations.length} subagents</span>
        </span>
      ) : null}
      {session.pullRequest !== null ? <span>PR #{session.pullRequest.number}</span> : null}
    </span>
  )
}

function sessionName(session: Session): string {
  return session.title?.text ?? session.id
}

export function SessionRosterItem({
  onFocus,
  onSelect,
  onRename,
  selected,
  session,
  tabIndex,
}: {
  onFocus: () => void
  onSelect: () => void
  onRename: () => void
  selected: boolean
  session: Session
  tabIndex: number
}) {
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger
          render={
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
                  <span className="block truncate font-medium">
                    <SessionReferenceText text={sessionName(session)} />
                  </span>
                  <span className="block truncate text-meta text-faint">
                    {activitySummary(session)}
                  </span>
                  <SessionMetadata session={session} />
                </span>
              </span>
            </button>
          }
        />
        <ContextMenuContent aria-label={`${sessionName(session)} actions`}>
          <ContextMenuGroup>
            <ContextMenuLabel>{sessionName(session)}</ContextMenuLabel>
            <ContextMenuItem onClick={onRename}>Rename</ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  )
}
