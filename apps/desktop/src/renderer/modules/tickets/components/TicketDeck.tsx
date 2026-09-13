import { useState } from 'react'

import type { Ticket } from '@/core/tickets/contract'
import { Button } from '../../../components/ui/button'
import { TicketDetail } from './TicketDetail'
import { TicketList } from './TicketList'

export type TicketDeckProps = {
  scope: string
  tickets: readonly Ticket[]
  onUnbind: () => void
}

// A selection that a new listing no longer holds falls back to nothing selected.
export function TicketDeck({ scope, tickets, onUnbind }: TicketDeckProps) {
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null)
  const selected = tickets.find((ticket) => ticket.number === selectedNumber) ?? null
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-(--size-chrome-bar) shrink-0 items-center gap-(--spacing-shell-item) border-b border-border/60 px-(--spacing-shell-inset)">
        <span className="type-meta text-muted-foreground">GitHub</span>
        <span className="min-w-0 flex-1 truncate font-mono type-body">{scope}</span>
        <Button onClick={onUnbind} size="sm" variant="ghost">
          Unbind
        </Button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-h-0 flex-col border-r border-border/60">
          <TicketList
            onSelect={setSelectedNumber}
            selectedNumber={selected?.number ?? null}
            tickets={tickets}
          />
        </div>
        <TicketDetail ticket={selected} />
      </div>
    </div>
  )
}
