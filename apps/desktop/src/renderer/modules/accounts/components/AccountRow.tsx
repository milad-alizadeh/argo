import { useRef, useState } from 'react'

import type { AccountSummary } from '@/core/accounts/contract'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { useFocusRescue } from '../../../lib/focus-rescue'

const STATE_BADGES = {
  connected: { label: 'Connected', variant: 'secondary' },
  revoked: { label: 'Access revoked', variant: 'destructive' },
  unreadable: { label: 'Sign-in unreadable', variant: 'destructive' },
} as const

const STATE_NOTES = {
  connected: null,
  revoked: 'GitHub no longer accepts this sign-in. Reconnect to read Tickets again.',
  unreadable:
    'Argo cannot open the stored sign-in on this computer. Reconnect to read Tickets again.',
} as const

export type AccountRowProps = {
  account: AccountSummary
  busy: boolean
  onDisconnect: () => void
  onReconnect: () => void
}

// What a revoked grant or a disconnect affects is named at Account scope, one line per Binding.
function Bindings({ account }: { account: AccountSummary }) {
  if (account.bindings.length === 0) {
    return <p className="type-meta text-muted-foreground">No Project is bound to this Account.</p>
  }
  return (
    <ul aria-label={`Bindings for ${account.login}`} className="grid gap-(--spacing-shell-tight)">
      {account.bindings.map((binding) => (
        <li className="type-meta text-muted-foreground" key={binding.projectId}>
          {binding.projectName} · <span className="font-mono">{binding.scope}</span>
        </li>
      ))}
    </ul>
  )
}

function disconnectQuestion({ login, bindings }: AccountSummary): string {
  if (bindings.length === 0) return `Disconnect ${login}?`
  const subject =
    bindings.length === 1 ? 'Its Binding stops' : `Its ${bindings.length} Bindings stop`
  return `Disconnect ${login}? ${subject} reading Tickets until you connect it again.`
}

function ConfirmDisconnect({ account, onDisconnect, onKeep, busy }: ConfirmProps) {
  return (
    <fieldset className="grid gap-(--spacing-shell-item)">
      <legend className="type-body">{disconnectQuestion(account)}</legend>
      <div className="flex gap-(--spacing-shell-item)">
        <Button disabled={busy} onClick={onDisconnect} size="sm" variant="destructive">
          Disconnect
        </Button>
        <Button data-focus-rescue disabled={busy} onClick={onKeep} size="sm" variant="ghost">
          Keep
        </Button>
      </div>
    </fieldset>
  )
}

type ConfirmProps = {
  account: AccountSummary
  busy: boolean
  onDisconnect: () => void
  onKeep: () => void
}

export function AccountRow({ account, busy, onDisconnect, onReconnect }: AccountRowProps) {
  const [confirming, setConfirming] = useState(false)
  const row = useRef<HTMLLIElement>(null)
  // Asking lands on Keep, the harmless answer, and answering lands back on Disconnect….
  useFocusRescue(row, confirming)
  const badge = STATE_BADGES[account.state]
  const note = STATE_NOTES[account.state]
  return (
    <li
      aria-label={`GitHub Account ${account.login}`}
      ref={row}
      className="grid gap-(--spacing-shell-item) rounded-lg border border-border/60 p-(--spacing-shell-gutter)"
    >
      <div className="flex items-center gap-(--spacing-shell-item)">
        <span className="type-body flex-1 truncate font-medium">{account.login}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      {note ? <p className="type-meta text-destructive">{note}</p> : null}
      <Bindings account={account} />
      {confirming ? (
        <ConfirmDisconnect
          account={account}
          busy={busy}
          onDisconnect={onDisconnect}
          onKeep={() => setConfirming(false)}
        />
      ) : (
        <div className="flex gap-(--spacing-shell-item)">
          {note ? (
            <Button onClick={onReconnect} size="sm">
              Reconnect
            </Button>
          ) : null}
          <Button data-focus-rescue onClick={() => setConfirming(true)} size="sm" variant="ghost">
            Disconnect…
          </Button>
        </div>
      )}
    </li>
  )
}
