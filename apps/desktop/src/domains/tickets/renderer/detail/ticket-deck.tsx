import type { Ticket, TicketStatus } from '@/domains/tickets/api/ticket'
import { AppPageSurface } from '@/platform/renderer/app/components/app-shell'
import { useLinkedSessions } from '../hooks'
import type { Backlog, TicketProblemProps } from '../lib'
import { TicketList } from '../sidebar'
import { ProblemBanner, TicketProblem } from '../status'
import { TicketDetail } from './ticket-detail'
import { TicketDetailReading } from './ticket-detail-empty'

// The selected Ticket as SQLite saved it, listed or not, and what its by-ID read is doing.
export type SelectedTicket = {
  ticket: Ticket | null
  statuses: readonly TicketStatus[]
  reading: boolean
  problem: TicketProblemProps | null
}

export type TicketDeckProps = {
  backlog: Backlog
  projectId: string
  selectedKey: string | null
  detail: SelectedTicket
  now: number
  onBack: () => void
  onSelect: (key: string) => void
  onOpenSession: (id: string) => void
}

// The Tickets route owns list/detail navigation. Its sidebar stays the Tickets tab's own surface,
// while this workspace switches from the complete list to the selected Ticket and back.
export function TicketDeck({
  backlog,
  projectId,
  selectedKey,
  detail,
  now,
  onBack,
  onSelect,
  onOpenSession,
}: TicketDeckProps) {
  // A listed row carries an edit in flight; the saved row covers an unlisted Ticket or a UUID link.
  const key = detail.ticket?.key ?? selectedKey
  const selected = backlog.tickets.find((ticket) => ticket.key === key) ?? detail.ticket
  const listed = new Set(backlog.tickets.map((ticket) => ticket.key))
  const linkedSessions = useLinkedSessions(projectId, selected?.key ?? null)
  if (selectedKey === null) {
    return <TicketList backlog={backlog} now={now} onSelect={onSelect} selectedKey={null} />
  }
  if (selected === null && detail.problem)
    return (
      <AppPageSurface>
        <TicketProblem {...detail.problem} />
      </AppPageSurface>
    )
  if (selected === null && detail.reading)
    return (
      <AppPageSurface>
        <TicketDetailReading reference={selectedKey} />
      </AppPageSurface>
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {detail.problem ? <ProblemBanner {...detail.problem} /> : null}
      <TicketDetail
        linkedSessions={linkedSessions}
        listed={listed}
        onBack={onBack}
        onChangePriority={(priority) =>
          selected && backlog.onChangePriority(selected.key, priority)
        }
        onChangeStatus={(status) => selected && backlog.onChangeStatus(selected.key, status)}
        onOpenSession={onOpenSession}
        onSelect={onSelect}
        priorityChoices={backlog.priorityChoices}
        provider={backlog.provider}
        statuses={backlog.statuses.length > 0 ? backlog.statuses : detail.statuses}
        ticket={selected}
        writable={backlog.writable}
      />
    </div>
  )
}
