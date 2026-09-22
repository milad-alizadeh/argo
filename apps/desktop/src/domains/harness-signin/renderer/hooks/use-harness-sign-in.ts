// One Harness sign-in as the screen sees it: start, then wait for the attempt to resolve. The
// attempt itself lives in the main process (#2579), so this hook owns no state of its own beyond
// the two mutations' own react-query cache, which is a projection of that attempt, not the truth.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  Harness,
  HarnessSignInCanceled,
  HarnessSignInResolved,
  HarnessSignInStarted,
} from '@/domains/harness-signin/contract/contract'
import { type ContractFailure, QUERY_KEYS, settle } from '@/platform/renderer/lib/query-client'

export type HarnessSignIn = {
  // Set once `start` has asked the main process and cleared once `wait` settles.
  isPending: boolean
  resolved: HarnessSignInResolved | null
  error: ContractFailure | null
  start: () => void
  cancel: () => void
}

export function useHarnessSignIn(harness: Harness): HarnessSignIn {
  const client = useQueryClient()
  const readiness = () => void client.invalidateQueries({ queryKey: QUERY_KEYS.harnessReadiness })
  const wait = useMutation<HarnessSignInResolved, ContractFailure>({
    mutationFn: () => settle(window.argo.waitHarnessSignIn({ harness })),
    onSettled: readiness,
  })
  // Asking again while an attempt is already pending resumes it, so a re-click after a remount
  // reaches the same attempt rather than starting a second one.
  const start = useMutation<HarnessSignInStarted, ContractFailure>({
    mutationFn: () => settle(window.argo.startHarnessSignIn({ harness })),
    onSuccess: () => wait.mutate(),
  })
  const cancel = useMutation<HarnessSignInCanceled, ContractFailure>({
    mutationFn: () => settle(window.argo.cancelHarnessSignIn({ harness })),
  })

  return {
    isPending: start.isPending || wait.isPending,
    resolved: wait.data ?? null,
    error: start.error ?? wait.error ?? cancel.error ?? null,
    start: () => start.mutate(),
    cancel: () => cancel.mutate(),
  }
}
