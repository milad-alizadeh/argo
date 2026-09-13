import { useState } from 'react'

import { InspectorSplit } from '../../../components/InspectorSplit'
import type { Backlog } from '../lib/backlog'
import { TicketDetail } from './TicketDetail'
import { TicketList } from './TicketList'

export type TicketDeckProps = { backlog: Backlog }

const TICKET_SPLIT = {
  inspector: '--size-ticket-inspector',
  inspectorMin: '--size-ticket-inspector-min',
  workspaceMin: '--size-ticket-workspace-min',
}

// A selection that a new listing no longer holds falls back to nothing selected.
export function TicketDeck({ backlog }: TicketDeckProps) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const selected = backlog.tickets.find((ticket) => ticket.number === selectedNumber) ?? null
  const listed = new Set(backlog.tickets.map((ticket) => ticket.number))
  return (
    <InspectorSplit
      inspector={
        <TicketDetail
          listed={listed}
          onSelect={setSelectedNumber}
          scope={backlog.scope}
          ticket={selected}
        />
      }
      noun="Ticket"
      reveal={selected?.number}
      sizes={TICKET_SPLIT}
      workspace={
        <div className="flex h-full min-h-0 flex-col">
          <TicketList
            backlog={backlog}
            onSelect={setSelectedNumber}
            selectedNumber={selected?.number ?? null}
          />
        </div>
      }
    />
  )
}
