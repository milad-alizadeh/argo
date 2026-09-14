import { Bot, Ticket } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '@/renderer/components/ui/context-menu'
import { HarnessLogo } from '../harness/HarnessLogo'
import { SESSION_CLIS, type SessionCli, sessionCliOf } from '../harness/harnesses'
import { PromptText } from '../prompt/PromptText'
import type { Session } from '../types'
import { SessionReferenceText } from './SessionReference'
import { sessionTiming } from './session-timing'

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

// The dot beside a Session carries its status as colour; this is that same fact in words, for a
// reader the dot's colour never reaches (apps/desktop/AGENTS.md "Accessible names").
const STATUS_LABELS: Record<Session['status'], string> = {
  asking: 'Asking',
  ended: 'Ended',
  idle: 'Idle',
  permission: 'Waiting on permission',
  running: 'Running',
  starting: 'Starting',
  stopped: 'Stopped',
  unknown: 'Unknown',
}

function knownCli(cli: string): cli is SessionCli {
  return (SESSION_CLIS as readonly string[]).includes(cli)
}

function activitySummary(session: Session): string {
  if (session.activity === null) return session.status
  return [session.activity.tool, session.activity.target].filter(Boolean).join(' ')
}

function planStepTone(session: Session, step: number) {
  if (session.plan?.state !== 'available') return 'bg-border'
  const completed = session.plan.entries.filter((entry) => entry.status === 'completed').length
  if (step < completed) {
    return session.status === 'running' ? 'bg-foreground/70' : 'bg-muted-foreground/50'
  }
  if (step === completed && session.status === 'running') return 'bg-foreground'
  return 'bg-border'
}

function SessionPlanBar({ session }: { session: Session }) {
  if (session.plan?.state !== 'available') return null
  const completed = session.plan.entries.filter((entry) => entry.status === 'completed').length
  return (
    <span
      aria-label={`${completed} of ${session.plan.entries.length} steps completed`}
      className="flex h-(--size-plan-bar) w-16 shrink-0 gap-px"
      role="img"
    >
      {session.plan.entries.map((entry, step) => (
        <span
          className={`min-w-0 flex-1 rounded-full ${planStepTone(session, step)}`}
          key={entry.position}
        />
      ))}
    </span>
  )
}

type SessionTimingValue = NonNullable<ReturnType<typeof sessionTiming>>

function SessionTiming({ timing }: { timing: SessionTimingValue }) {
  return (
    <time
      className="inline-flex shrink-0 tabular-nums"
      dateTime={timing.dateTime}
      title={timing.label}
    >
      {timing.text}
    </time>
  )
}

function SessionMetadata({ session }: { session: Session }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const timing = sessionTiming(session, now)
  const hasMetadata =
    session.plan?.state === 'available' ||
    session.plan?.state === 'malformed' ||
    session.delegations.length > 0 ||
    session.pullRequest !== null ||
    timing !== null
  if (!hasMetadata) return null
  return (
    <span className="mt-1 flex items-center gap-2 type-meta text-faint [&_svg]:size-(--size-icon-metadata)">
      {timing === null ? null : <SessionTiming timing={timing} />}
      <SessionPlanBar session={session} />
      {session.plan?.state === 'malformed' ? <span>Plan unreadable</span> : null}
      {session.delegations.length > 0 ? (
        <span className="inline-flex items-center gap-1">
          <Bot aria-hidden="true" />
          <span>{session.delegations.length}</span>
        </span>
      ) : null}
      {session.pullRequest !== null ? (
        <span className="inline-flex items-center gap-1">
          <Ticket aria-hidden="true" />
          <span>#{session.pullRequest.number}</span>
        </span>
      ) : null}
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
    <li className="min-w-0">
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
              <span className="flex items-start gap-2">
                <span aria-hidden="true" className="relative flex h-5 w-4 shrink-0 items-center">
                  {knownCli(session.cli) ? <HarnessLogo cli={session.cli} /> : null}
                  <span
                    className={`absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full ring-2 ring-sidebar ${STATUS_MARKS[session.status]}`}
                  />
                </span>
                <span className="sr-only">{STATUS_LABELS[session.status]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-heading font-medium text-foreground">
                    <PromptText
                      interactiveLinks={false}
                      renderText={(value) => (
                        <SessionReferenceText cli={sessionCliOf(session)} text={value} />
                      )}
                      text={sessionName(session)}
                    />
                  </span>
                  <span className="mt-0.5 block truncate type-meta text-faint">
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
