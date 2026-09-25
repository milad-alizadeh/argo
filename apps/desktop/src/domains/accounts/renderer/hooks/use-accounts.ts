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
  void client.invalidateQueries({ queryKey: QUERY_KEYS.tickets })
}

export function useAccounts() {
  return useQuery<AccountListing, ContractFailure>({
    ...trpc.accountList.queryOptions(),
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
    ...trpc.accountDisconnect.mutationOptions(),
    mutationFn: (accountId: string) => trpcClient.accountDisconnect.mutate({ accountId }),
  })

export const useDismissNotice = () =>
  useListingAction({
    ...trpc.accountDismissNotice.mutationOptions(),
    mutationFn: () => trpcClient.accountDismissNotice.mutate(),
  })
