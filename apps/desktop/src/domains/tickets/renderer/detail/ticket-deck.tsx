import { useLinkedSessions } from '../hooks/use-linked-sessions'
import type { Backlog } from '../lib/backlog'
import { TicketList } from '../sidebar/ticket-list'
import { TicketDetail } from './ticket-detail'

export type TicketDeckProps = {
  backlog: Backlog
  projectId: string
  selectedKey: string | null
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
  now,
  onBack,
  onSelect,
  onOpenSession,
}: TicketDeckProps) {
  const selected = backlog.tickets.find((ticket) => ticket.key === selectedKey) ?? null
  const listed = new Set(backlog.tickets.map((ticket) => ticket.key))
  const linkedSessions = useLinkedSessions(projectId, selected?.key ?? null)
  if (selectedKey === null) {
    return <TicketList backlog={backlog} now={now} onSelect={onSelect} selectedKey={null} />
  }
  return (
    <TicketDetail
      linkedSessions={linkedSessions}
      listed={listed}
      onBack={onBack}
      onChangePriority={(priority) => selected && backlog.onChangePriority(selected.key, priority)}
      onChangeStatus={(status) => selected && backlog.onChangeStatus(selected.key, status)}
      onOpenSession={onOpenSession}
      onSelect={onSelect}
      provider={backlog.provider}
      statuses={backlog.statuses}
      ticket={selected}
    />
  )
}
