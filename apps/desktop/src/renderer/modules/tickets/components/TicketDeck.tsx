import { BookMarked } from 'lucide-react'
import { useState } from 'react'

import type { Ticket } from '@/core/tickets/contract'
import { InspectorSplit } from '../../../components/InspectorSplit'
import { Button } from '../../../components/ui/button'
import { TicketDetail } from './TicketDetail'
import { TicketList } from './TicketList'

export type TicketDeckProps = {
  scope: string
  tickets: readonly Ticket[]
  onUnbind: () => void
}

// The owner reads quieter than the repository name, as GitHub writes it.
function Repository({ scope }: { scope: string }) {
  const slash = scope.indexOf('/')
  return (
    <h1 className="flex min-w-0 items-center gap-(--spacing-shell-item) type-heading">
      <BookMarked
        aria-hidden="true"
        className="size-(--size-icon-control) shrink-0 text-muted-foreground"
      />
      <span className="truncate">
        <span className="text-muted-foreground">{scope.slice(0, slash + 1)}</span>
        {scope.slice(slash + 1)}
      </span>
    </h1>
  )
}

const TICKET_SPLIT = {
  inspector: '--size-ticket-inspector',
  inspectorMin: '--size-ticket-inspector-min',
  workspaceMin: '--size-ticket-workspace-min',
}

// A selection that a new listing no longer holds falls back to nothing selected.
export function TicketDeck({ scope, tickets, onUnbind }: TicketDeckProps) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const selected = tickets.find((ticket) => ticket.number === selectedNumber) ?? null
  return (
    <InspectorSplit
      inspector={<TicketDetail ticket={selected} />}
      noun="Ticket"
      reveal={selected?.number}
      sizes={TICKET_SPLIT}
      workspace={
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex h-(--size-chrome-bar) shrink-0 items-center gap-(--spacing-shell-item) border-b border-border/60 px-(--spacing-shell-inset)">
            <Repository scope={scope} />
            <Button onClick={onUnbind} size="xs" variant="ghost">
              Unbind
            </Button>
          </header>
          <TicketList
            onSelect={setSelectedNumber}
            selectedNumber={selected?.number ?? null}
            tickets={tickets}
          />
        </div>
      }
    />
  )
}
