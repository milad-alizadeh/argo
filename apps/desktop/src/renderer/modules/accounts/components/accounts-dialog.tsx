import { TriangleAlert } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import type { AccountConnected } from '@/core/accounts/contract'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { useContractText } from '../../../i18n/contract-text'
import { firstControl, useFocusRescue } from '../../../lib/focus-rescue'
import type { ContractFailure } from '../../../lib/query-client'
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
  onDisconnect: (accountId: string) => void
}

function Failure({ error }: { error: ContractFailure }) {
  const contractText = useContractText()
  return (
    <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
      <TriangleAlert aria-hidden="true" />
      <AlertDescription>{contractText(error)}</AlertDescription>
    </Alert>
  )
}

export function AccountsPanel({
  listing,
  listError,
  signIn,
  disconnecting,
  disconnectError,
  onDisconnect,
}: AccountsPanelProps) {
  const { t } = useTranslation('accounts')
  const panel = useRef<HTMLDivElement>(null)
  const accounts = listing?.accounts ?? []
  // A disconnected row takes its focused control with it.
  useFocusRescue(panel, accounts.length)
  return (
    <div className="grid gap-(--spacing-shell-inset)" ref={panel}>
      {listError ? <Failure error={listError} /> : null}
      {listing === null && listError === null ? (
        <p className="type-meta text-muted-foreground" role="status">
          {t('list.reading')}
        </p>
      ) : null}
      {listing && accounts.length === 0 ? (
        <p className="type-body text-muted-foreground">{t('list.empty')}</p>
      ) : null}
      {accounts.length > 0 ? (
        <ul
          aria-label={t('list.label')}
          className="grid divide-y divide-border/60 rounded-lg border border-border/60"
        >
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
      {disconnectError ? <Failure error={disconnectError} /> : null}
      <SignInPanel {...signIn} providers={listing?.providers ?? []} />
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
export function AccountsDialog() {
  const { t } = useTranslation('accounts')
  const { open, opener, setOpen } = useAccountsDialog()
  const accounts = useAccounts()
  const { connected, ...signIn } = useSignIn()
  const disconnect = useDisconnect()
  const onOpenChange = (next: boolean) => {
    if (!next) {
      signIn.cancel()
      disconnect.reset()
    }
    setOpen(next)
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" finalFocus={() => returnFocus(opener)}>
        <DialogHeader>
          <DialogTitle>{t('dialog.title')}</DialogTitle>
          <DialogDescription>{t('dialog.description')}</DialogDescription>
        </DialogHeader>
        <AccountsPanel
          disconnectError={disconnect.error}
          disconnecting={disconnect.isPending ? (disconnect.variables ?? null) : null}
          listError={accounts.error}
          listing={accounts.data ?? null}
          onDisconnect={(accountId) => disconnect.mutate(accountId)}
          signIn={{ ...signIn, connected: signedIn(connected) }}
        />
      </DialogContent>
    </Dialog>
  )
}
