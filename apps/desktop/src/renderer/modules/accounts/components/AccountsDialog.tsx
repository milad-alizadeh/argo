import { TriangleAlert } from 'lucide-react'
import { useRef } from 'react'

import type { AccountConnected } from '@/core/accounts/contract'
import { Alert, AlertDescription } from '../../../components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { firstControl, useFocusRescue } from '../../../lib/focus-rescue'
import type { ContractFailure } from '../../../lib/query-client'
import { type AccountListing, useAccounts, useDisconnect } from '../hooks/useAccounts'
import { useSignIn } from '../hooks/useSignIn'
import { useAccountsDialog } from '../state/useAccountsDialog'
import { AccountRow } from './AccountRow'
import { type SignedIn, SignInPanel, type SignInPanelProps } from './SignInPanel'

export type AccountsPanelProps = {
  listing: AccountListing | null
  listError: ContractFailure | null
  signIn: SignInPanelProps
  disconnecting: string | null
  disconnectError: ContractFailure | null
  onDisconnect: (accountId: string) => void
}

function Failure({ error }: { error: ContractFailure }) {
  return (
    <Alert className="border-destructive/50 bg-destructive/10" variant="destructive">
      <TriangleAlert aria-hidden="true" />
      <AlertDescription>{error.message}</AlertDescription>
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
  const panel = useRef<HTMLDivElement>(null)
  const accounts = listing?.accounts ?? []
  // A disconnected row takes its focused control with it.
  useFocusRescue(panel, accounts.length)
  return (
    <div className="grid gap-(--spacing-shell-inset)" ref={panel}>
      {listError ? <Failure error={listError} /> : null}
      {listing === null && listError === null ? (
        <p className="type-meta text-muted-foreground" role="status">
          Reading Accounts…
        </p>
      ) : null}
      {listing && accounts.length === 0 ? (
        <p className="type-body text-muted-foreground">No GitHub Account is connected.</p>
      ) : null}
      {accounts.length > 0 ? (
        <ul aria-label="GitHub Accounts" className="grid gap-(--spacing-shell-item)">
          {accounts.map((account) => (
            <AccountRow
              account={account}
              busy={disconnecting === account.id}
              key={account.id}
              onDisconnect={() => onDisconnect(account.id)}
              onReconnect={signIn.start}
            />
          ))}
        </ul>
      ) : null}
      {disconnectError ? <Failure error={disconnectError} /> : null}
      <SignInPanel {...signIn} />
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
          <DialogTitle>GitHub Accounts</DialogTitle>
          <DialogDescription>
            Argo reads Tickets through these Accounts. Each GitHub identity is its own Account.
          </DialogDescription>
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
