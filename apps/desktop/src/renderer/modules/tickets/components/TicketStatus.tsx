// A Ticket's status and priority, drawn where the provider keeps them. Only Linear keeps a priority.
// The icon's shape carries the category, so a status is never its colour alone.
import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  Contrast,
  type LucideIcon,
  OctagonAlert,
  SignalHigh,
  SignalLow,
  SignalMedium,
} from 'lucide-react'
import type { TicketPriority, TicketStatus } from '@/core/tickets/contract'

const markIcon = 'size-(--size-icon-meta) shrink-0'

type Mark = { Icon: LucideIcon; tone: string }

const CATEGORY_MARKS: Record<TicketStatus['category'], Mark> = {
  triage: { Icon: CircleAlert, tone: 'text-warn' },
  backlog: { Icon: CircleDashed, tone: 'text-faint' },
  unstarted: { Icon: Circle, tone: 'text-idle' },
  started: { Icon: Contrast, tone: 'text-active' },
  completed: { Icon: CircleCheck, tone: 'text-plan' },
  canceled: { Icon: CircleX, tone: 'text-faint' },
}

// Level 1 is the most urgent.
const PRIORITY_MARKS: Record<TicketPriority['level'], Mark> = {
  1: { Icon: OctagonAlert, tone: 'text-danger' },
  2: { Icon: SignalHigh, tone: 'text-muted-foreground' },
  3: { Icon: SignalMedium, tone: 'text-muted-foreground' },
  4: { Icon: SignalLow, tone: 'text-muted-foreground' },
}

export function StatusIcon({ status }: { status: TicketStatus }) {
  const { Icon, tone } = CATEGORY_MARKS[status.category]
  return <Icon aria-hidden="true" className={`${markIcon} ${tone}`} />
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
