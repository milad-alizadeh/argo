// Connecting a Session to a Ticket (CONTEXT.md L1 · Session → Ticket, issue #2134): a search over
// the Project's own connected Ticket source, one Ticket picked, then the rename decision the
// connect hook resolves. A custom title asks before it is replaced; a summarised or first-prompt
// one is replaced without asking, since it cost the reader nothing to make.
import { useState } from 'react'
import { Button } from '@/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/renderer/components/ui/dialog'
import { Input } from '@/renderer/components/ui/input'
import { useConnection, useTicketList } from '../../../tickets/hooks/use-tickets'
import type { ConnectTicketInput } from '../../hooks/use-session-ticket-link'
import type { Session } from '../../types'

type PendingRename = { session: Session; ticket: ConnectTicketInput }

function TicketPicker({
  projectId,
  query,
  onQueryChange,
  onPick,
  error,
  onCancel,
}: {
  projectId: string | null
  query: string
  onQueryChange: (value: string) => void
  onPick: (ticket: ConnectTicketInput) => void
  error: string | null
  onCancel: () => void
}) {
  const connection = useConnection(projectId)
  const list = useTicketList(projectId, connection.data ?? null, query)
  const tickets = list.data?.pages.flatMap((page) => page.tickets) ?? []

  return (
    <div className="grid gap-2">
      <Input
        aria-label="Search Tickets"
        autoFocus
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search Tickets…"
        value={query}
      />
      <ul className="grid max-h-72 gap-1 overflow-y-auto">
        {tickets.map((ticket) => (
          <li key={ticket.key}>
            <button
              className="w-full rounded-row px-2 py-1 text-left hover:bg-muted"
              onClick={() =>
                onPick({
                  projectId: projectId ?? '',
                  key: ticket.key,
                  title: ticket.title,
                  state: ticket.state,
                })
              }
              type="button"
            >
              <span className="truncate">{ticket.title}</span>
              <span className="ml-2 shrink-0 font-mono text-muted-foreground">{ticket.key}</span>
            </button>
          </li>
        ))}
      </ul>
      {error === null ? null : (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </DialogFooter>
    </div>
  )
}

function RenameConfirm({
  title,
  onDecide,
}: {
  title: string
  onDecide: (rename: boolean) => void
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm text-muted-foreground">
        This Session has a name a person typed by hand. Replace it with “{title}”?
      </p>
      <DialogFooter>
        <Button onClick={() => onDecide(false)} type="button" variant="outline">
          Keep name
        </Button>
        <Button onClick={() => onDecide(true)} type="button">
          Rename
        </Button>
      </DialogFooter>
    </div>
  )
}

export function SessionTicketLinkDialog({
  onOpenChange,
  onConnect,
  projectId,
  session,
}: {
  onOpenChange: (open: boolean) => void
  onConnect: (
    session: Session,
    ticket: ConnectTicketInput,
    options?: { confirmedRename?: boolean },
  ) => Promise<{ needsRenameConfirmation: boolean; renameFailure: string | null }>
  projectId: string | null
  session: Session | null
}) {
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<PendingRename | null>(null)
  const open = session !== null

  const close = () => {
    setQuery('')
    setError(null)
    setConfirming(null)
    onOpenChange(false)
  }

  async function pick(ticket: ConnectTicketInput) {
    if (session === null) return
    setError(null)
    const outcome = await onConnect(session, ticket)
    if (outcome.needsRenameConfirmation) {
      setConfirming({ session, ticket })
      return
    }
    if (outcome.renameFailure !== null) setError(outcome.renameFailure)
    close()
  }

  async function confirmRename(rename: boolean) {
    if (confirming === null) return
    if (!rename) {
      close()
      return
    }
    const outcome = await onConnect(confirming.session, confirming.ticket, {
      confirmedRename: true,
    })
    if (outcome.renameFailure !== null) setError(outcome.renameFailure)
    close()
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) close()
      }}
      open={open}
    >
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{confirming === null ? 'Link Ticket' : 'Rename Session?'}</DialogTitle>
        </DialogHeader>
        {confirming === null ? (
          <TicketPicker
            error={error}
            onCancel={close}
            onPick={(ticket) => void pick(ticket)}
            onQueryChange={setQuery}
            projectId={projectId}
            query={query}
          />
        ) : (
          <RenameConfirm
            onDecide={(rename) => void confirmRename(rename)}
            title={confirming.ticket.title}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
