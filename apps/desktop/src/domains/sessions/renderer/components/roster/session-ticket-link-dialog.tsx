// Connecting a Session to a Ticket (CONTEXT.md L1 · Session → Ticket, issue #2134): a search over
// the Project's own connected Ticket source, one Ticket picked, then the rename decision the
// connect hook resolves. A custom title asks before it is replaced; a summarised or first-prompt
// one is replaced without asking, since it cost the reader nothing to make.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConnectTicketInput } from '@/domains/sessions/renderer/hooks/use-session-ticket-link'
import type { Session } from '@/domains/sessions/renderer/types'
import { useConnection, useTicketList } from '@/domains/tickets/renderer/hooks/use-tickets'
import { Button } from '@/platform/renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/platform/renderer/components/ui/dialog'
import { Input } from '@/platform/renderer/components/ui/input'

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
  const { t } = useTranslation('sessions')
  const connection = useConnection(projectId)
  const list = useTicketList(projectId, connection.data ?? null, query)
  const tickets = list.data?.pages.flatMap((page) => page.tickets) ?? []

  return (
    <div className="grid gap-2">
      <Input
        aria-label={t('ticketLink.search')}
        autoFocus
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t('ticketLink.searchPlaceholder')}
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
        <p className="type-body text-destructive" role="alert">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button onClick={onCancel} type="button" variant="outline">
          {t('ticketLink.cancel')}
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
  const { t } = useTranslation('sessions')
  return (
    <div className="grid gap-2">
      <p className="type-body text-muted-foreground">
        {t('ticketLink.renameDescription', { title })}
      </p>
      <DialogFooter>
        <Button onClick={() => onDecide(false)} type="button" variant="outline">
          {t('ticketLink.keepName')}
        </Button>
        <Button onClick={() => onDecide(true)} type="button">
          {t('ticketLink.rename')}
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
  const { t } = useTranslation('sessions')
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
          <DialogTitle>
            {confirming === null ? t('ticketLink.title') : t('ticketLink.renameTitle')}
          </DialogTitle>
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
