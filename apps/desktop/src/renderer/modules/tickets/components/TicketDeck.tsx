import { InspectorSplit } from '../../../components/InspectorSplit'
import { useLinkedSessions } from '../hooks/useLinkedSessions'
import type { Backlog } from '../lib/backlog'
import { TicketDetail } from './TicketDetail'
import { TicketList } from './TicketList'

export type TicketDeckProps = {
  backlog: Backlog
  projectId: string
  selectedKey: string | null
  onSelect: (key: string) => void
  onOpenSession: (id: string) => void
}

const TICKET_SPLIT = {
  inspector: '--size-ticket-inspector',
  inspectorMin: '--size-ticket-inspector-min',
  workspaceMin: '--size-ticket-workspace-min',
}

// A selection that a new listing no longer holds falls back to nothing selected. The Ticket
// router (CONTEXT.md L1 · Ticket) owns the selection itself, so a reload or a Session's "Open
// Ticket" navigation lands on the same Ticket.
export function TicketDeck({
  backlog,
  projectId,
  selectedKey,
  onSelect,
  onOpenSession,
}: TicketDeckProps) {
  const selected = backlog.tickets.find((ticket) => ticket.key === selectedKey) ?? null
  const listed = new Set(backlog.tickets.map((ticket) => ticket.key))
  const linkedSessions = useLinkedSessions(projectId, selected?.key ?? null)
  return (
    <InspectorSplit
      defaultInspectorSize="50%"
      inspector={
        <TicketDetail
          linkedSessions={linkedSessions}
          listed={listed}
          onChangeStatus={(status) => selected && backlog.onChangeStatus(selected.key, status)}
          onOpenSession={onOpenSession}
          onSelect={onSelect}
          provider={backlog.provider}
          statuses={backlog.statuses}
          ticket={selected}
        />
      }
      noun="Ticket"
      reveal={selected?.key}
      sizes={TICKET_SPLIT}
      workspace={
        <div className="flex h-full min-h-0 flex-col">
          <TicketList
            backlog={backlog}
            now={Date.now()}
            onSelect={onSelect}
            selectedKey={selected?.key ?? null}
          />
        </div>
      }
    />
  )
}
