import { Lock } from 'lucide-react'

import { Badge } from '@/renderer/components/ui/badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '@/renderer/components/ui/context-menu'
import { HarnessLogo } from '../../harness/harness-logo'
import { SESSION_CLIS, type SessionCli, sessionCliOf } from '../../harness/harnesses'
import { PromptText } from '../../prompt/prompt-text'
import type { Session } from '../../types'
import { sessionPostureLocksAnswer } from '../../types'
import { SessionReferenceText } from '../composer/references/session-reference'
import { SessionMetadata } from './session-roster-metadata'
import './session-roster-item.css'

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

// The two blocking statuses the dot already colours `bg-warn` for, named so a reader can tell
// which one without opening the Session (#2088). Every other status shows no badge.
const BLOCKED_BADGE_LABELS: Partial<Record<Session['status'], string>> = {
  asking: 'Answer',
  permission: 'Permission Approval',
}

// An `asking` Session whose posture locks the answer affordance (#2205) cannot take an answer
// here, whatever its transcript shows.
function unanswerableHere(session: Session): boolean {
  return session.status === 'asking' && sessionPostureLocksAnswer(session.posture)
}

function SessionBlockedBadge({ session }: { session: Session }) {
  if (unanswerableHere(session)) return null
  const label = BLOCKED_BADGE_LABELS[session.status]
  if (label === undefined) return null
  return (
    <Badge className="border-warn/40 text-warn" size="compact" variant="outline">
      {label}
    </Badge>
  )
}

// Another live Argo window holds this Session's channel (ADR-0040), or it is asking a question
// from a PTY Argo never opened (#2205): either way Send is refused, so the fact goes in text
// beside the title rather than only in a tooltip (apps/desktop/AGENTS.md "Accessible names" — a
// mark that is not a control).
const OPEN_ELSEWHERE_MESSAGE =
  'This session is open in another app. Close it there to continue it in Argo.'

function SessionLockedMark({ session }: { session: Session }) {
  if (session.locked !== true && !unanswerableHere(session)) return null
  return (
    <span className="inline-flex shrink-0 items-center" title={OPEN_ELSEWHERE_MESSAGE}>
      <Lock aria-hidden className="size-3.5 text-faint" />
      <span className="sr-only">{OPEN_ELSEWHERE_MESSAGE}</span>
    </span>
  )
}

function activitySummary(session: Session): string | null {
  if (session.activity === null) return null
  return [session.activity.tool, session.activity.target].filter(Boolean).join(' ')
}

function sessionName(session: Session): string {
  return session.title?.text ?? session.id
}

export function SessionRosterItem({
  onFocus,
  onSelect,
  onRename,
  onOpenTicket,
  onLinkTicket,
  onUnlinkTicket,
  selected,
  session,
  tabIndex,
}: {
  onFocus: () => void
  onSelect: () => void
  onRename: () => void
  onOpenTicket: () => void
  onLinkTicket: () => void
  onUnlinkTicket: () => void
  selected: boolean
  session: Session
  tabIndex: number
}) {
  const activity = activitySummary(session)
  return (
    <li className="min-w-0">
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <button
              aria-current={selected ? 'page' : undefined}
              className={`w-full rounded-lg px-2 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'bg-selected text-foreground' : 'hover:bg-muted'}`}
              data-session-id={session.id}
              onClick={onSelect}
              onFocus={onFocus}
              tabIndex={tabIndex}
              type="button"
            >
              <span className="flex items-start gap-2">
                <span aria-hidden="true" className="relative flex h-5 w-4 shrink-0 items-center">
                  <span className="roster-harness-mark">
                    {knownCli(session.cli) ? <HarnessLogo cli={session.cli} /> : null}
                  </span>
                  <span
                    className={`absolute -right-0.5 bottom-0 size-(--size-state-dot) rounded-full ${STATUS_MARKS[session.status]}`}
                  />
                </span>
                <span className="sr-only">{STATUS_LABELS[session.status]}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="block min-w-0 truncate type-heading font-medium text-foreground">
                      <PromptText
                        interactiveLinks={false}
                        renderText={(value) => (
                          <SessionReferenceText cli={sessionCliOf(session)} text={value} />
                        )}
                        text={sessionName(session)}
                      />
                    </span>
                    <SessionBlockedBadge session={session} />
                    <SessionLockedMark session={session} />
                  </span>
                  {activity === null ? null : (
                    <span className="mt-0.5 block truncate type-meta text-faint">{activity}</span>
                  )}
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
            {session.ticket !== null ? (
              <>
                <ContextMenuItem onClick={onOpenTicket}>Open Ticket</ContextMenuItem>
                <ContextMenuItem onClick={onUnlinkTicket}>Unlink Ticket</ContextMenuItem>
              </>
            ) : (
              <ContextMenuItem onClick={onLinkTicket}>Link Ticket…</ContextMenuItem>
            )}
          </ContextMenuGroup>
        </ContextMenuContent>
      </ContextMenu>
    </li>
  )
}
