// One GitHub device-flow sign-in as the screen sees it: ask for a code, show it, open GitHub when
// the person asks, and wait for the grant. The device code and the grant stay in the main process.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AccountChallenge, AccountConnected } from '@/core/accounts/contract'
import { type ContractFailure, settle } from '../../../lib/query-client'
import { accountAction } from '../lib/requests'
import { storeListing } from './useAccounts'

export type SignInPhase = 'idle' | 'requesting' | 'code' | 'connected'

export type SignIn = {
  phase: SignInPhase
  challenge: AccountChallenge | null
  connected: AccountConnected | null
  error: ContractFailure | null
  start: () => void
  openGitHub: () => void
  cancel: () => void
}

export function useSignIn(): SignIn {
  const client = useQueryClient()
  const wait = useMutation({
    mutationFn: () => settle(window.argo.awaitAccount(accountAction('account.await'))),
    onSuccess: (reply) => storeListing(client, reply),
  })
  const connect = useMutation({
    mutationFn: () => settle(window.argo.connectAccount(accountAction('account.connect'))),
    onSuccess: () => wait.mutate(),
  })
  const verify = useMutation({
    mutationFn: () => settle(window.argo.verifyAccount(accountAction('account.verify'))),
  })
  // A reset observer ignores the abandoned wait's late `sign-in-cancelled` reply.
  const clear = () => {
    connect.reset()
    verify.reset()
    wait.reset()
  }
  const challenge = wait.isPending ? (connect.data ?? null) : null

  function phase(): SignInPhase {
    if (connect.isPending) return 'requesting'
    if (challenge) return 'code'
    return wait.isSuccess ? 'connected' : 'idle'
  }

  return {
    phase: phase(),
    challenge,
    connected: wait.data ?? null,
    error: connect.error ?? wait.error ?? verify.error ?? null,
    start: () => {
      clear()
      connect.mutate()
    },
    // A clipboard that refuses leaves the code on screen, which is all the person needs.
    openGitHub: () => {
      if (challenge) void navigator.clipboard.writeText(challenge.userCode).catch(() => undefined)
      verify.mutate()
    },
    cancel: () => {
      const pending = connect.isPending || challenge !== null
      clear()
      if (pending) void window.argo.cancelAccount(accountAction('account.cancel'))
    },
  }
}
