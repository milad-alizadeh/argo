import { type ReactNode, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { AccountConnected } from '@/domains/accounts/contract/contract'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { HarnessReadinessList, useHarnessReadiness } from '@/domains/harness-signin/renderer'
import { ContractFailureAlert } from '@/platform/renderer/components/contract-failure-alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/platform/renderer/components/ui/dialog'
import { firstControl, useFocusRescue } from '@/platform/renderer/lib/focus-rescue'
import type { ContractFailure } from '@/platform/renderer/lib/query-client'
import { type AccountListing, useAccounts, useDisconnect } from '../hooks/use-accounts'
import { useSignIn } from '../hooks/use-sign-in'
import { useAccountsDialog } from '../state/use-accounts-dialog'
import { AccountRow } from './account-row'
import { type SignedIn, SignInPanel, type SignInPanelProps } from './sign-in-panel'

export type AccountsPanelProps = {
  listing: AccountListing | null
  listError: ContractFailure | null
  signIn: Omit<SignInPanelProps, 'providers'>
  disconnecting: string | null
  disconnectError: ContractFailure | null
  // The repository-connect form's fields, drawn by the caller so this module names no Ticket type.
  connect?: ReactNode
  onDisconnect: (accountId: string) => void
  // Null while the first read has not landed. Claude and Codex sign in to their own CLI, never an
  // Account (ADR-0047), so this draws as its own section rather than joining the list above.
  harnesses: HarnessReadiness[] | null
}

function AgentSignIns({ harnesses }: { harnesses: HarnessReadiness[] | null }) {
  const { t } = useTranslation('harnessSignIn')
  if (!harnesses) return null
  return (
    <section
      aria-label={t('accounts.title')}
      className="grid gap-(--spacing-shell-item) border-t border-border/60 pt-(--spacing-shell-inset)"
    >
      <div>
        <h3 className="type-heading">{t('accounts.title')}</h3>
        <p className="type-meta text-muted-foreground">{t('accounts.description')}</p>
      </div>
      <HarnessReadinessList harnesses={harnesses} />
    </section>
  )
}

export function AccountsPanel({
  listing,
  listError,
  signIn,
  disconnecting,
  disconnectError,
  connect,
  onDisconnect,
  harnesses,
}: AccountsPanelProps) {
  const { t } = useTranslation('accounts')
  const panel = useRef<HTMLDivElement>(null)
  const accounts = listing?.accounts ?? []
  // A disconnected row takes its focused control with it.
  useFocusRescue(panel, accounts.length)
  return (
    <div className="grid gap-(--spacing-shell-inset)" ref={panel}>
      {listError ? <ContractFailureAlert error={listError} /> : null}
      {listing === null && listError === null ? (
        <p className="type-meta text-muted-foreground" role="status">
          {t('list.reading')}
        </p>
      ) : null}
      {listing && accounts.length === 0 ? (
        <p className="type-body text-muted-foreground">{t('list.empty')}</p>
      ) : null}
      {accounts.length > 0 || connect ? (
        <div className="grid divide-y divide-border/60 rounded-lg border border-border/60">
          {accounts.length > 0 ? (
            <ul aria-label={t('list.label')} className="grid divide-y divide-border/60">
              {accounts.map((account) => (
                <AccountRow
                  account={account}
                  busy={disconnecting === account.id}
                  key={account.id}
                  onDisconnect={() => onDisconnect(account.id)}
                  onReconnect={() => signIn.start(account.provider)}
                />
              ))}
            </ul>
          ) : null}
          {connect ? <div className="p-(--spacing-shell-gutter)">{connect}</div> : null}
        </div>
      ) : null}
      {disconnectError ? <ContractFailureAlert error={disconnectError} /> : null}
      <SignInPanel {...signIn} providers={listing?.providers ?? []} />
      <AgentSignIns harnesses={harnesses} />
    </div>
  )
}

function signedIn(reply: AccountConnected | null): SignedIn | null {
  const account = reply?.accounts.find((candidate) => candidate.id === reply.accountId)
  return reply && account ? { login: account.login, outcome: reply.outcome } : null
}

// A sign-in replaces the room's Connect control that opened the dialog, so closing lands on the
// room's first control instead of the body.
function returnFocus(opener: Element | null): HTMLElement | true {
  if (opener?.isConnected) return true
  return firstControl(document.querySelector('main')) ?? true
}

// Closing the dialog abandons a sign-in in progress, so no code outlives the screen that showed it.
export function AccountsDialog({ connect }: { connect?: ReactNode }) {
  const { t } = useTranslation('accounts')
  const { open, opener, setOpen } = useAccountsDialog()
  const accounts = useAccounts()
  const harnesses = useHarnessReadiness()
  const { connected, ...signIn } = useSignIn()
  const disconnect = useDisconnect()
  const onOpenChange = (next: boolean) => {
    if (!next) {
      signIn.cancel()
      disconnect.reset()
    }
    setOpen(next)
  }
  // A repository connects and the screen behind the dialog takes over, so nothing is left open.
  const wasConnecting = useRef(false)
  useEffect(() => {
    if (connect) wasConnecting.current = true
    else if (wasConnecting.current) {
      wasConnecting.current = false
      setOpen(false)
    }
  }, [connect, setOpen])
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" finalFocus={() => returnFocus(opener)}>
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>
        <AccountsPanel
          connect={connect}
          disconnectError={disconnect.error}
          disconnecting={disconnect.isPending ? (disconnect.variables ?? null) : null}
          harnesses={harnesses.data ?? null}
          listError={accounts.error}
          listing={accounts.data ?? null}
          onDisconnect={(accountId) => disconnect.mutate(accountId)}
          signIn={{ ...signIn, connected: signedIn(connected) }}
        />
      </DialogContent>
    </Dialog>
  )
}
