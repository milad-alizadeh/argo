// A Ticket's status and priority, drawn where the provider keeps them. Only Linear keeps a priority.
// The icon's shape carries the category, so a status is never its colour alone.
import { type LucideIcon, OctagonAlert, SignalHigh, SignalLow, SignalMedium } from 'lucide-react'
import type { TicketPriority, TicketStatus } from '@/core/tickets/contract'
import { StatusGlyph } from './status-glyph'

const markIcon = 'size-(--size-icon-meta) shrink-0'

type Mark = { Icon: LucideIcon; tone: string }

const CATEGORY_TONES: Record<TicketStatus['category'], string> = {
  triage: 'text-warn',
  backlog: 'text-faint',
  unstarted: 'text-idle',
  started: 'text-warn',
  completed: 'text-ticket-done',
  canceled: 'text-faint',
}

// The nth started status fills 1/2, 3/4, 7/8 of its pie, so a later stage reads as further on.
function startedShare(status: TicketStatus, statuses: readonly TicketStatus[]) {
  const started = statuses.filter((candidate) => candidate.category === 'started')
  const stage = Math.max(started.map(({ id }) => id).indexOf(status.id), 0)
  return 1 - 0.5 ** (stage + 1)
}

// Level 1 is the most urgent.
const PRIORITY_MARKS: Record<TicketPriority['level'], Mark> = {
  1: { Icon: OctagonAlert, tone: 'text-danger' },
  2: { Icon: SignalHigh, tone: 'text-muted-foreground' },
  3: { Icon: SignalMedium, tone: 'text-muted-foreground' },
  4: { Icon: SignalLow, tone: 'text-muted-foreground' },
}

// `statuses` is the provider's list, which places a started status among its fellows.
export function StatusIcon({
  status,
  statuses = [],
}: {
  status: TicketStatus
  statuses?: readonly TicketStatus[]
}) {
  return (
    <StatusGlyph
      category={status.category}
      className={`${markIcon} ${CATEGORY_TONES[status.category]}`}
      share={startedShare(status, statuses)}
    />
  )
}

// In a row the name is for a screen reader; in the Detail it is written beside the icon.
export function StatusMark({ status, named }: { status: TicketStatus; named: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground">
      <StatusIcon status={status} />
      <span className={named ? undefined : 'sr-only'}>{status.name}</span>
    </span>
  )
}

export function PriorityMark({ priority }: { priority: TicketPriority }) {
  const { Icon, tone } = PRIORITY_MARKS[priority.level]
  return (
    <span className="flex shrink-0 items-center gap-(--spacing-shell-tight) type-meta text-muted-foreground">
      <Icon aria-hidden="true" className={`${markIcon} ${tone}`} />
      {priority.label}
    </span>
  )
}
