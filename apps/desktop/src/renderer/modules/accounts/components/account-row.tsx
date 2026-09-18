import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AccountState, AccountSummary } from '@/core/accounts/contract'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { useFocusRescue } from '../../../lib/focus-rescue'
import { providerPresentation } from '../lib/providers'

// How each Account state draws: its badge, and the note saying why, which a connected Account has
// no need of.
const STATE_PRESENTATION = {
  connected: { variant: 'secondary', note: null },
  expired: { variant: 'destructive', note: 'note.expired' },
  revoked: { variant: 'destructive', note: 'note.revoked' },
  unreadable: { variant: 'destructive', note: 'note.unreadable' },
} as const satisfies Record<AccountState, { variant: string; note: string | null }>

export type AccountRowProps = {
  account: AccountSummary
  busy: boolean
  onDisconnect: () => void
  onReconnect: () => void
}

// What a revoked grant or a disconnect affects is named at Account scope, one line per Connection.
function Connections({ account }: { account: AccountSummary }) {
  const { t } = useTranslation('accounts')
  if (account.connections.length === 0) {
    return <p className="type-meta text-muted-foreground">{t('row.noConnections')}</p>
  }
  return (
    <ul
      // A whole sentence per provider: a language where a noun does not simply take a capital at
      // the front cannot be served by capitalising the scope word here.
      aria-label={t(`row.connections.${account.provider}`, { login: account.login })}
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

// Labelled by its question rather than a legend: a legend sits outside the grid's gap.
function ConfirmDisconnect({ account, onDisconnect, onKeep, busy }: ConfirmProps) {
  const { t } = useTranslation('accounts')
  const question = useId()
  const { login, connections, provider } = account
  return (
    <fieldset
      aria-labelledby={question}
      className="grid min-w-0 gap-(--spacing-shell-gutter) rounded-md bg-muted/60 p-(--spacing-shell-gutter)"
    >
      <p className="type-body" id={question}>
        {connections.length === 0
          ? t('confirm.unconnected', { login })
          : t(`confirm.${provider}`, { login, count: connections.length })}
      </p>
      <div className="flex gap-(--spacing-shell-item)">
        <Button disabled={busy} onClick={onDisconnect} size="sm" variant="destructive">
          {t('confirm.disconnect')}
        </Button>
        <Button data-focus-rescue disabled={busy} onClick={onKeep} size="sm" variant="ghost">
          {t('confirm.keep')}
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
  const { t } = useTranslation('accounts')
  const [confirming, setConfirming] = useState(false)
  const row = useRef<HTMLLIElement>(null)
  // Asking lands on Keep, the harmless answer, and answering lands back on Disconnect….
  useFocusRescue(row, confirming)
  const { name } = providerPresentation(account.provider)
  const { variant, note } = STATE_PRESENTATION[account.state]
  const reason = note ? t(note, { provider: name }) : null
  return (
    <li
      aria-label={t('row.label', { provider: name, login: account.login })}
      ref={row}
      className="grid gap-(--spacing-shell-item) p-(--spacing-shell-gutter)"
    >
      <div className="flex min-h-7 items-center gap-(--spacing-shell-item)">
        <span className="type-heading min-w-0 truncate">{account.login}</span>
        {account.workspace ? (
          <span className="type-meta min-w-0 truncate text-muted-foreground">
            {account.workspace}
          </span>
        ) : null}
        <Badge size="compact" variant={variant}>
          {t(`state.${account.state}`)}
        </Badge>
        <span className="flex-1" />
        {confirming ? null : (
          <Button data-focus-rescue onClick={() => setConfirming(true)} size="sm" variant="ghost">
            {t('row.disconnect')}
          </Button>
        )}
      </div>
      <Connections account={account} />
      {reason ? (
        <div className="grid justify-items-start gap-(--spacing-shell-item)">
          <p className="type-meta text-destructive">{reason}</p>
          {confirming ? null : (
            <Button onClick={onReconnect} size="sm" variant="outline">
              {t('row.reconnect')}
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
