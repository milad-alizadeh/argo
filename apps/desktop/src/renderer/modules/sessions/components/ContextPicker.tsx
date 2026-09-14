import { Ban, File, Folder, GitBranch, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { ComposerTicketContext } from '../state/useComposerStore'
import { useContextPickerFocus } from './useContextPickerFocus'

type TicketChoice = Omit<ComposerTicketContext, 'id'>

const TICKETS: readonly TicketChoice[] = [
  {
    provider: 'github',
    key: '#2150',
    title: 'Add a shared context picker to the Session composer',
    status: 'Open',
    terminal: false,
    blocked: false,
  },
  {
    provider: 'linear',
    key: 'ENG-42',
    title: 'Keep the Composer draft in sync',
    status: 'In Progress',
    terminal: false,
    blocked: true,
  },
  {
    provider: 'linear',
    key: 'ENG-9',
    title: 'Store the refresh token',
    status: 'Done',
    terminal: true,
    blocked: null,
  },
  {
    provider: 'github',
    key: '#609',
    title: 'Prototype the Tickets room',
    status: 'Closed',
    terminal: true,
    blocked: false,
  },
]

function ProviderLogo({ provider }: { provider: TicketChoice['provider'] }) {
  return provider === 'github' ? (
    <GitBranch aria-hidden="true" className="size-4 shrink-0" />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-primary font-bold text-primary-foreground type-meta"
    >
      L
    </span>
  )
}

function TicketResult({
  onSelect,
  ticket,
}: {
  onSelect: (ticket: TicketChoice) => void
  ticket: TicketChoice
}) {
  return (
    <button
      className="flex w-full items-center gap-(--spacing-shell-item) rounded-lg px-(--spacing-shell-inset) py-(--spacing-shell-item) text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
      onClick={() => onSelect(ticket)}
      type="button"
    >
      <ProviderLogo provider={ticket.provider} />
      <span className="sr-only">{ticket.provider === 'github' ? 'GitHub' : 'Linear'} </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-(--spacing-shell-tight) type-label">
          <span className="shrink-0 font-mono text-muted-foreground">{ticket.key}</span>
          <span className="truncate">{ticket.title}</span>
        </span>
        <span
          className={ticket.terminal ? 'type-meta text-danger' : 'type-meta text-muted-foreground'}
        >
          {ticket.terminal ? `Terminal · ${ticket.status}` : ticket.status}
        </span>
      </span>
      {ticket.blocked ? (
        <span className="flex shrink-0 items-center gap-1 text-danger type-meta">
          <Ban aria-hidden="true" className="size-3.5" />
          <span>Blocked</span>
        </span>
      ) : null}
    </button>
  )
}

export function ContextPicker({
  onAttach,
  onClose,
  onSelectTicket,
}: {
  onAttach: () => void
  onClose: () => void
  onSelectTicket: (ticket: TicketChoice) => void
}) {
  const [query, setQuery] = useState('')
  const focus = useContextPickerFocus(onClose)
  const shownTickets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (normalized === '') return TICKETS.filter((ticket) => !ticket.terminal)
    return TICKETS.filter(({ key, title }) => `${key} ${title}`.toLowerCase().includes(normalized))
  }, [query])
  return (
    <div
      aria-label="Context picker"
      aria-modal="true"
      className="absolute bottom-full left-0 z-40 mb-2 w-full max-w-lg rounded-xl border bg-card p-(--spacing-shell-item) shadow-xl"
      onKeyDown={focus.onKeyDown}
      ref={focus.pickerRef}
      role="dialog"
    >
      <div className="mb-(--spacing-shell-item) flex items-center gap-(--spacing-shell-item)">
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <input
          aria-label="Search context"
          className="min-w-0 flex-1 bg-transparent type-body outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Tickets"
          ref={focus.searchRef}
          value={query}
        />
        <button
          aria-label="Close context picker"
          className="rounded-sm p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={onClose}
          type="button"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="border-t pt-(--spacing-shell-item)">
        <button
          className="flex w-full items-center gap-(--spacing-shell-item) rounded-lg px-(--spacing-shell-inset) py-(--spacing-shell-item) text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          onClick={onAttach}
          type="button"
        >
          <File aria-hidden="true" className="size-4" />
          <Folder aria-hidden="true" className="-ml-2 size-4" />
          <span className="type-label">Files & folders</span>
        </button>
      </div>
      <div className="mt-(--spacing-shell-item) border-t pt-(--spacing-shell-item)">
        <p className="px-(--spacing-shell-inset) type-meta text-muted-foreground">Tickets</p>
        {shownTickets.map((ticket) => (
          <TicketResult
            key={`${ticket.provider}-${ticket.key}`}
            onSelect={onSelectTicket}
            ticket={ticket}
          />
        ))}
      </div>
      <div className="mt-(--spacing-shell-item) border-t pt-(--spacing-shell-item)">
        <button
          aria-disabled="true"
          className="flex w-full cursor-not-allowed items-center gap-(--spacing-shell-item) rounded-lg px-(--spacing-shell-inset) py-(--spacing-shell-item) text-left text-muted-foreground type-label"
          disabled
          type="button"
        >
          Goals <span className="type-meta">Coming soon</span>
        </button>
      </div>
    </div>
  )
}
