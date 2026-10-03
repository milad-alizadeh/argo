import { cn } from 'cn'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AccountState, AccountSummary } from '@/domains/accounts/contract/contract'
import {
  readinessBodyRecipe,
  readinessDetailRecipe,
  readinessHeaderRecipe,
  readinessRowRecipe,
  readinessTitleRecipe,
} from '@/platform/renderer/components/design-system/readiness-row-recipes'
import { StatusBadge } from '@/platform/renderer/components/design-system/status-badge'
import {
  dangerActionRecipe,
  indicatorToneRecipe,
} from '@/platform/renderer/components/design-system/tone-recipes'
import { Badge } from '@/platform/renderer/components/ui/badge'
import { Button } from '@/platform/renderer/components/ui/button'
import { useFocusRescue } from '@/platform/renderer/lib/focus-rescue'
import { providerPresentation } from '@/providers/presentation-registry'

// How each Account state draws: its badge, and the note saying why, which a connected Account has
// no need of.
const STATE_PRESENTATION = {
  connected: { tone: null, note: null },
  expired: { tone: 'danger', note: 'note.expired' },
  revoked: { tone: 'danger', note: 'note.revoked' },
  unreadable: { tone: 'danger', note: 'note.unreadable' },
} as const satisfies Record<AccountState, { tone: 'danger' | null; note: string | null }>

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
    return <p className={readinessDetailRecipe}>{t('row.noConnections')}</p>
  }
  return (
    <ul
      // A whole sentence per provider: a language where a noun does not simply take a capital at
      // the front cannot be served by capitalising the scope word here.
      aria-label={t(`row.connections.${account.provider}`, { login: account.login })}
      className="grid gap-(--spacing-shell-tight)"
    >
      {account.connections.map((connection) => (
        <li className={readinessDetailRecipe} key={connection.projectId}>
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
        <Button
          className={dangerActionRecipe}
          disabled={busy}
          onClick={onDisconnect}
          size="sm"
          variant="ghost"
        >
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
  const { tone, note } = STATE_PRESENTATION[account.state]
  const stateLabel = t(`state.${account.state}`)
  const reason = note ? t(note, { provider: name }) : null
  return (
    <li
      aria-label={t('row.label', { provider: name, login: account.login })}
      ref={row}
      className={readinessRowRecipe}
    >
      <div className={readinessHeaderRecipe}>
        <span className={readinessTitleRecipe}>{account.login}</span>
        {account.workspace ? (
          <span className={cn(readinessDetailRecipe, 'min-w-0 truncate')}>{account.workspace}</span>
        ) : null}
        {tone === null ? (
          <Badge variant="secondary">{stateLabel}</Badge>
        ) : (
          <StatusBadge tone={tone}>{stateLabel}</StatusBadge>
        )}
        <span className="flex-1" />
        {confirming ? null : (
          <Button
            className="ml-auto"
            data-focus-rescue
            onClick={() => setConfirming(true)}
            size="sm"
            variant="ghost"
          >
            {t('row.disconnect')}
          </Button>
        )}
      </div>
      <Connections account={account} />
      {reason ? (
        <div className={readinessBodyRecipe}>
          <p className={cn(readinessDetailRecipe, indicatorToneRecipe.danger)}>{reason}</p>
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
