import { useTranslation } from 'react-i18next'

import type { Session, SessionId } from '../types'

import { PlanBar } from './PlanBar'
import { PullRequestAddress } from './PullRequestAddress'
import { SessionClock } from './SessionClock'
import { SessionMarker } from './SessionMarker'
import { SessionStatus } from './SessionStatus'
import { TicketAddress } from './TicketAddress'

type SessionListItemProps = {
  session: Session
  selected: boolean
  /** The Roster is one tab stop, so exactly one row in the list carries a reachable tabIndex. */
  focusable: boolean
  /** The Ticket this run answers to. No reading holds one yet, so nothing passes it (#1907). */
  ticket?: number
  onSelect: (sessionId: SessionId) => void
  onFocus: (sessionId: SessionId) => void
}

// A settled Session is doing nothing, so what its last Turn did is history rather than activity.
const SETTLED: readonly Session['status'][] = ['idle', 'stopped', 'ended']

// A settled row is a run that has stopped, and it has to read as one at a glance rather than only
// through the ink of its dot: the title drops to the quiet ink at the regular weight, the way the
// design draws a row nobody is waiting on (`roster-row-signals.html` · `.row.fold .title`). A
// live run keeps the medium weight and the full ink, so the running rows are what the eye finds
// first down a long list.
const TITLE = 'roster__name min-w-0 flex-1 truncate text-body tracking-[-0.05px]'
const LIVE_TITLE = `${TITLE} font-medium text-ink`
const SETTLED_TITLE = `${TITLE} font-normal text-quiet`

function SessionActivity({ session }: { session: Session }) {
  const { t } = useTranslation()
  const { activity } = session
  if (activity === null || SETTLED.includes(session.status)) return null
  return (
    // rowMeta, in the interface face: what the Session is doing is a sentence, not a machine fact.
    <span className="roster__activity truncate text-meta text-faint">
      {activity.target === null
        ? t('row.activityBare', { tool: activity.tool })
        : t('row.activity', { tool: activity.tool, target: activity.target })}
    </span>
  )
}

// The approved Session row (#1310, `cockpit-roster-row.html`): a leading column that holds the
// state and what runs under it, and a body of lines hung off one x. Line 1 is the title, line 2
// what the Session is doing, line 3 how it is going and, at its trailing edge, the addresses the
// run answers to. The line height is the design's 1.45 rather than the app's own, because every
// measure on the row — the dot's inset above all — is derived from the title's line box.
export function SessionListItem({
  session,
  selected,
  focusable,
  ticket,
  onSelect,
  onFocus,
}: SessionListItemProps) {
  const moving = session.status === 'starting' || session.status === 'running'

  return (
    <button
      // Ground alone carries selection: no leading accent rule on a row. A rule down the left of
      // the selected row reads as a container edge rather than as a mark on the row. An external
      // Session is one Argo does not own the terminal of, and it is ghosted whole.
      className={`roster__row flex w-full items-start gap-2 rounded-(--radius-row) px-2 py-[7px] text-left leading-[1.45] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-active data-[posture=external]:opacity-[0.58] ${selected ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/50'}`}
      aria-current={selected}
      data-posture={session.posture}
      tabIndex={focusable ? 0 : -1}
      onFocus={() => onFocus(session.id)}
      onClick={() => onSelect(session.id)}
      type="button"
    >
      <SessionMarker session={session} />
      <span className="flex min-w-0 flex-1 flex-col gap-hair">
        <span className="flex w-full min-w-0 items-center gap-tight">
          {/* The title is DERIVED and can be absent, and an absent title is drawn as the id rather
              than as a guess at what the Session is about (CONTEXT.md L2 · CLI title). */}
          <span className={SETTLED.includes(session.status) ? SETTLED_TITLE : LIVE_TITLE}>
            {session.title?.text ?? session.id}
          </span>
          <SessionStatus status={session.status} />
        </span>
        <SessionActivity session={session} />
        <span className="mt-hair flex min-w-0 items-center gap-2">
          <SessionClock session={session} />
          {session.plan === null ? null : <PlanBar moving={moving} plan={session.plan} />}
          {/* The addresses take the trailing edge, so a column of rows lines its numbers up on one
              x whatever the clock and the Plan before them are worth. */}
          <span className="min-w-0 flex-1" />
          {ticket === undefined ? null : <TicketAddress ticket={ticket} />}
          {session.pullRequest === null ? null : (
            <PullRequestAddress pullRequest={session.pullRequest} state={null} />
          )}
        </span>
      </span>
    </button>
  )
}
