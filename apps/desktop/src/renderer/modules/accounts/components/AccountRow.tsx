import { useId, useRef, useState } from 'react'

import type { AccountState, AccountSummary } from '@/core/accounts/contract'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { useFocusRescue } from '../../../lib/focus-rescue'
import { capitalized, PROVIDER_PRESENTATION } from '../lib/providers'

const STATE_BADGES = {
  connected: { label: 'Connected', variant: 'secondary' },
  expired: { label: 'Sign-in expired', variant: 'destructive' },
  revoked: { label: 'Access revoked', variant: 'destructive' },
  unreadable: { label: 'Sign-in unreadable', variant: 'destructive' },
} as const

const STATE_NOTES: Record<AccountState, ((provider: string) => string) | null> = {
  connected: null,
  expired: (provider) =>
    `The sign-in expired and ${provider} would not renew it. Reconnect to read Tickets again.`,
  revoked: (provider) =>
    `${provider} no longer accepts this sign-in. Reconnect to read Tickets again.`,
  unreadable: () =>
    'Argo cannot open the stored sign-in on this computer. Reconnect to read Tickets again.',
}

export type AccountRowProps = {
  account: AccountSummary
  busy: boolean
  onDisconnect: () => void
  onReconnect: () => void
}

// What a revoked grant or a disconnect affects is named at Account scope, one line per Connection.
function Connections({ account }: { account: AccountSummary }) {
  if (account.connections.length === 0) {
    return (
      <p className="type-meta text-muted-foreground">
        No Project reads Tickets through this Account.
      </p>
    )
  }
  const { scope } = PROVIDER_PRESENTATION[account.provider]
  return (
    <ul
      aria-label={`${capitalized(scope.many)} for ${account.login}`}
      className="grid gap-(--spacing-shell-tight)"
    >
      {account.connections.map((connection) => (
        <li className="type-meta text-muted-foreground" key={connection.projectId}>
          {connection.projectName} · <span className="font-mono">{connection.label}</span>
        </li>
      ))}
    </ul>
  )
}

function disconnectQuestion({ login, connections, provider }: AccountSummary): string {
  if (connections.length === 0) return `Disconnect ${login}?`
  const { scope } = PROVIDER_PRESENTATION[provider]
  const subject =
    connections.length === 1
      ? `Its ${scope.one} stops`
      : `Its ${connections.length} ${scope.many} stop`
  return `Disconnect ${login}? ${subject} reading Tickets until you connect it again.`
}

// Labelled by its question rather than a legend: a legend sits outside the grid's gap.
function ConfirmDisconnect({ account, onDisconnect, onKeep, busy }: ConfirmProps) {
  const question = useId()
  return (
    <fieldset
      aria-labelledby={question}
      className="grid min-w-0 gap-(--spacing-shell-gutter) rounded-md bg-muted/60 p-(--spacing-shell-gutter)"
    >
      <p className="type-body" id={question}>
        {disconnectQuestion(account)}
      </p>
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
  const { name } = PROVIDER_PRESENTATION[account.provider]
  const note = STATE_NOTES[account.state]?.(name) ?? null
  return (
    <li
      aria-label={`${name} Account ${account.login}`}
      ref={row}
      className="grid gap-(--spacing-shell-item) p-(--spacing-shell-gutter)"
    >
      <div className="flex min-h-7 items-center gap-(--spacing-shell-item)">
        <span className="type-body min-w-0 truncate font-medium">{account.login}</span>
        {account.workspace ? (
          <span className="type-meta min-w-0 truncate text-muted-foreground">
            {account.workspace}
          </span>
        ) : null}
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="flex-1" />
        {confirming ? null : (
          <Button data-focus-rescue onClick={() => setConfirming(true)} size="sm" variant="ghost">
            Disconnect…
          </Button>
        )}
      </div>
      <Connections account={account} />
      {note ? (
        <div className="grid justify-items-start gap-(--spacing-shell-item)">
          <p className="type-meta text-destructive">{note}</p>
          {confirming ? null : (
            <Button onClick={onReconnect} size="sm" variant="outline">
              Reconnect
            </Button>
          )}
        </div>
      ) : null}
      {confirming ? (
        <ConfirmDisconnect
          account={account}
          busy={busy}
          onDisconnect={onDisconnect}
          onKeep={() => setConfirming(false)}
        />
      ) : null}
    </li>
  )
}
