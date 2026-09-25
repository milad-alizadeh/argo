import { useLayoutEffect } from 'react'
import { useLinkedSessions } from '../hooks/use-linked-sessions'
import type { Backlog } from '../lib/backlog'
import { useTicketBacklogSidebar } from '../sidebar/ticket-backlog-sidebar-store'
import { TicketDetail } from './ticket-detail'

export type TicketDeckProps = {
  backlog: Backlog
  projectId: string
  selectedKey: string | null
  onSelect: (key: string) => void
  onOpenSession: (id: string) => void
}

// A selection that a new listing no longer holds falls back to nothing selected. The shell owns
// the backlog, so this deck is only the selected Ticket's workspace. The Ticket router
// (CONTEXT.md L1 · Ticket) owns the selection itself, so a reload or a Session's "Open Ticket"
// navigation lands on the same Ticket.
export function TicketDeck({
  backlog,
  projectId,
  selectedKey,
  onSelect,
  onOpenSession,
}: TicketDeckProps) {
  const setSidebar = useTicketBacklogSidebar((state) => state.setSidebar)
  const selected = backlog.tickets.find((ticket) => ticket.key === selectedKey) ?? null
  const listed = new Set(backlog.tickets.map((ticket) => ticket.key))
  const linkedSessions = useLinkedSessions(projectId, selected?.key ?? null)
  useLayoutEffect(() => {
    setSidebar({ backlog, selectedKey, onSelect })
    return () => setSidebar(null)
  }, [backlog, onSelect, selectedKey, setSidebar])
  return (
    <TicketDetail
      linkedSessions={linkedSessions}
      listed={listed}
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
