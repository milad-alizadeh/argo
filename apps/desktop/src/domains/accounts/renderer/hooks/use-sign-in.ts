// One sign-in as the screen sees it: GitHub's device code shown and entered on GitHub, or Linear's
// consent page opened in the browser, then the wait for the grant. The grant stays in main.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  AccountChallenge,
  AccountConnected,
  Provider,
} from '@/domains/accounts/contract/contract'
import { type ContractFailure, settle } from '@/platform/renderer/lib/query-client'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'
import { storeListing } from './use-accounts'

export type SignInPhase = 'idle' | 'requesting' | 'waiting' | 'connected'

export type SignIn = {
  phase: SignInPhase
  // The provider being signed in to, while a sign-in is asked for or waited on.
  provider: Provider | null
  challenge: AccountChallenge | null
  connected: AccountConnected | null
  error: ContractFailure | null
  start: (provider: Provider) => void
  openProvider: () => void
  cancel: () => void
}

export function useSignIn(): SignIn {
  const client = useQueryClient()
  const wait = useMutation<AccountConnected, ContractFailure>({
    ...trpc.accountWait.mutationOptions(),
    mutationFn: () => settle(trpcClient.accountWait.mutate()),
    onSuccess: (reply) => storeListing(client, reply),
  })
  const verify = useMutation<AccountChallenge, ContractFailure>({
    ...trpc.accountVerify.mutationOptions(),
    mutationFn: () => settle(trpcClient.accountVerify.mutate()),
  })
  // Linear has no code to show first, so its consent page opens as soon as it is asked for.
  const connect = useMutation<AccountChallenge, ContractFailure, Provider>({
    ...trpc.accountConnect.mutationOptions(),
    mutationFn: (provider) => settle(trpcClient.accountConnect.mutate({ provider })),
    onSuccess: (challenge) => {
      wait.mutate()
      if (challenge.provider === 'linear') verify.mutate()
    },
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
    if (challenge) return 'waiting'
    return wait.isSuccess ? 'connected' : 'idle'
  }

  return {
    phase: phase(),
    provider: connect.isPending || challenge ? (connect.variables ?? null) : null,
    challenge,
    connected: wait.data ?? null,
    error: connect.error ?? wait.error ?? verify.error ?? null,
    start: (provider) => {
      clear()
      connect.mutate(provider)
    },
    // A clipboard that refuses leaves the code on screen, which is all the person needs.
    openProvider: () => {
      if (challenge?.provider === 'github') {
        void navigator.clipboard.writeText(challenge.userCode).catch(() => undefined)
      }
      verify.mutate()
    },
    cancel: () => {
      const pending = connect.isPending || challenge !== null
      clear()
      if (pending) void trpcClient.accountCancel.mutate()
    },
  }
}
