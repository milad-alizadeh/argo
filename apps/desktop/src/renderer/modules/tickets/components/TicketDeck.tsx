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
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const selected = backlog.tickets.find((ticket) => ticket.key === selectedKey) ?? null
  const listed = new Set(backlog.tickets.map((ticket) => ticket.key))
  return (
    <InspectorSplit
      defaultInspectorSize="50%"
      inspector={
        <TicketDetail
          listed={listed}
          onChangeStatus={(status) => selected && backlog.onChangeStatus(selected.key, status)}
          onSelect={setSelectedKey}
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
            onSelect={setSelectedKey}
            selectedKey={selected?.key ?? null}
          />
        </div>
      }
    />
  )
}
