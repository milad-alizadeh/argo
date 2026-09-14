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
import { HarnessLogo } from '../harness/HarnessLogo'
import { SESSION_CLIS, type SessionCli, sessionCliOf } from '../harness/harnesses'
import { PromptText } from '../prompt/PromptText'
import type { Session } from '../types'
import { SessionReferenceText } from './SessionReference'
import { SessionMetadata } from './SessionRosterMetadata'

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

function SessionBlockedBadge({ session }: { session: Session }) {
  const label = BLOCKED_BADGE_LABELS[session.status]
  if (label === undefined) return null
  return (
    <Badge className="border-warn/40 text-warn" size="compact" variant="outline">
      {label}
    </Badge>
  )
}

// Another live Argo window holds this Session's channel (ADR-0040): Send is refused, so the
// fact goes in text beside the title rather than only in a tooltip (apps/desktop/AGENTS.md
// "Accessible names" — a mark that is not a control).
const OPEN_ELSEWHERE_MESSAGE =
  'This session is open in another app. Close it there to continue it in Argo.'

function SessionLockedMark({ session }: { session: Session }) {
  if (session.locked !== true) return null
  return (
    <span className="inline-flex shrink-0 items-center" title={OPEN_ELSEWHERE_MESSAGE}>
      <Lock aria-hidden className="size-3.5 text-faint" />
      <span className="sr-only">{OPEN_ELSEWHERE_MESSAGE}</span>
    </span>
  )
}

function activitySummary(session: Session): string {
  if (session.activity === null) return session.status
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
                  <span className="flex items-center gap-2">
                    <span className="block min-w-0 truncate type-label font-medium text-foreground">
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
                  <span className="mt-0.5 block truncate type-roster-meta text-faint">
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
