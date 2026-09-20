// A Ticket's status and priority, drawn where the provider keeps them. Only Linear keeps a priority.
// The icon's shape carries the category, so a status is never its colour alone.
import { OctagonAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TicketPriority, TicketStatus } from '@/domains/tickets/contract/contract'
import { StatusGlyph } from '@/domains/tickets/renderer/status/status-glyph'

const markIcon = 'size-(--size-icon-meta) shrink-0'

type Mark = { render: () => ReactNode; tone: string }

const CATEGORY_TONES: Record<TicketStatus['category'], string> = {
  triage: 'text-warn',
  backlog: 'text-faint',
  unstarted: 'text-idle',
  started: 'text-warn',
  completed: 'text-ticket-done',
  canceled: 'text-faint',
}

// Three ascending bars, drawn in the 14x14 box `StatusGlyph` also draws in, so priority and status
// read at the same size. `filled` counts bars lit solid; the rest stay at low opacity. `null` draws
// three flat dashes instead of bars, Linear's own mark for "No priority".
const BAR_X = [1.5, 5.5, 9.5]
const BAR_HEIGHT = [4, 7, 10]
const BAR_BASELINE = 12.5
const DASH_HEIGHT = 2

function PriorityBars({ filled }: { filled: 0 | 1 | 2 | 3 | null }) {
  return (
    <svg aria-hidden="true" className={markIcon} viewBox="0 0 14 14">
      {BAR_X.map((x, index) => {
        const height = filled === null ? DASH_HEIGHT : (BAR_HEIGHT[index] ?? DASH_HEIGHT)
        const lit = filled === null || index < filled
        return (
          <rect
            fill="currentColor"
            height={height}
            key={x}
            opacity={lit ? 1 : 0.3}
            rx="1"
            width="3"
            x={x}
            y={BAR_BASELINE - height}
          />
        )
      })}
    </svg>
  )
}

// The nth started status fills 1/2, 3/4, 7/8 of its pie, so a later stage reads as further on.
function startedShare(status: TicketStatus, statuses: readonly TicketStatus[]) {
  const started = statuses.filter((candidate) => candidate.category === 'started')
  const stage = Math.max(started.map(({ id }) => id).indexOf(status.id), 0)
  return 1 - 0.5 ** (stage + 1)
}

// Level 1 is the most urgent; null is Linear's own "No priority".
const PRIORITY_MARKS: Record<TicketPriority['level'], Mark> = {
  1: {
    render: () => <OctagonAlert aria-hidden="true" className={markIcon} />,
    tone: 'text-danger',
  },
  2: { render: () => <PriorityBars filled={3} />, tone: 'text-muted-foreground' },
  3: { render: () => <PriorityBars filled={2} />, tone: 'text-muted-foreground' },
  4: { render: () => <PriorityBars filled={1} />, tone: 'text-muted-foreground' },
}
const NO_PRIORITY_MARK: Mark = { render: () => <PriorityBars filled={null} />, tone: 'text-faint' }

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
  const { render, tone } = priority ? PRIORITY_MARKS[priority.level] : NO_PRIORITY_MARK
  return <span className={tone}>{render()}</span>
}
