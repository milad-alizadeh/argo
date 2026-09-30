// The connected Accounts, read once and replaced by whatever listing an Account action answers with.
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AccountListed, AccountListReply } from '@/domains/accounts/contract/contract'
import { type ContractFailure, QUERY_KEYS, settle } from '@/platform/renderer/lib/query-client'
import { trpc, trpcClient } from '@/platform/renderer/trpc-client'

export type AccountListing = Pick<AccountListed, 'accounts' | 'notice' | 'providers'>

const listing = ({ accounts, notice, providers }: AccountListing): AccountListing => ({
  accounts,
  notice,
  providers,
})

// A Connection's summary names its Account's state, so a new listing is a new reading of Connections too.
export function storeListing(client: QueryClient, next: AccountListing): void {
  client.setQueryData(QUERY_KEYS.accounts, listing(next))
  for (const procedure of [trpc.ticketConnection, trpc.ticketActive, trpc.ticketDiscover])
    void client.invalidateQueries({ queryKey: procedure.pathKey() })
}

export function useAccounts() {
  return useQuery<AccountListing, ContractFailure>({
    queryKey: QUERY_KEYS.accounts,
    queryFn: async () => listing(await settle(trpcClient.accountList.query())),
  })
}

function useListingAction<Input>(options: {
  mutationKey: readonly unknown[]
  mutationFn: (input: Input) => Promise<AccountListReply>
}) {
  const client = useQueryClient()
  return useMutation<AccountListed, ContractFailure, Input>({
    ...options,
    mutationFn: (input) => settle(options.mutationFn(input)),
    onSuccess: (next) => storeListing(client, next),
  })
}

export const useDisconnect = () =>
  useListingAction({
    mutationKey: ['accounts', 'disconnect'],
    mutationFn: (accountId: string) => trpcClient.accountDisconnect.mutate({ accountId }),
  })
