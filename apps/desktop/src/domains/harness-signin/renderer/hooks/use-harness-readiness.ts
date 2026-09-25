// The readiness of every supported Harness, read once and refetched by whoever starts a sign-in.
// The empty-state screen and the Accounts "Agent sign-ins" section are a later ticket's build.
import { useQuery } from '@tanstack/react-query'
import type { HarnessReadiness } from '@/domains/harness-signin/contract/contract'
import { type ContractFailure, QUERY_KEYS, settle } from '@/platform/renderer/lib/query-client'
import { trpcClient } from '@/platform/renderer/trpc-client'

export function useHarnessReadiness() {
  return useQuery<HarnessReadiness[], ContractFailure>({
    queryKey: QUERY_KEYS.harnessReadiness,
    queryFn: async () => (await settle(trpcClient.harnessReadinessList.query())).harnesses,
  })
}
