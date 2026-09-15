// A Ticket's status and priority, drawn where the provider keeps them. Only Linear keeps a priority.
// The icon's shape carries the category, so a status is never its colour alone.
import {
  type LucideIcon,
  OctagonAlert,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
} from 'lucide-react'
import type { TicketPriority, TicketStatus } from '@/core/tickets/contract'
import { StatusGlyph } from './StatusGlyph'

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

// Level 1 is the most urgent; null is Linear's own "No priority".
const PRIORITY_MARKS: Record<TicketPriority['level'], Mark> = {
  1: { Icon: OctagonAlert, tone: 'text-danger' },
  2: { Icon: SignalHigh, tone: 'text-muted-foreground' },
  3: { Icon: SignalMedium, tone: 'text-muted-foreground' },
  4: { Icon: SignalLow, tone: 'text-muted-foreground' },
}
const NO_PRIORITY_MARK: Mark = { Icon: SignalZero, tone: 'text-faint' }

// Linear's own words for every level a Ticket's priority can move to, No priority included.
export const PRIORITY_OPTIONS: readonly (TicketPriority | null)[] = [
  null,
  { level: 1, label: 'Urgent' },
  { level: 2, label: 'High' },
  { level: 3, label: 'Medium' },
  { level: 4, label: 'Low' },
]
export const NO_PRIORITY_LABEL = 'No priority'
export const priorityName = (priority: TicketPriority | null): string =>
  priority?.label ?? NO_PRIORITY_LABEL

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

export function PriorityIcon({ priority }: { priority: TicketPriority | null }) {
  const { Icon, tone } = priority ? PRIORITY_MARKS[priority.level] : NO_PRIORITY_MARK
  return <Icon aria-hidden="true" className={`${markIcon} ${tone}`} />
}
