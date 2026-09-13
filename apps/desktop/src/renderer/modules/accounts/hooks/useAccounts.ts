// The connected Accounts, read once and replaced by whatever listing an Account action answers with.
import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AccountListed, AccountListReply } from '@/core/accounts/contract'
import { QUERY_KEYS, settle } from '../../../lib/query-client'
import { accountAction, disconnectRequest } from '../lib/requests'

export type AccountListing = Pick<AccountListed, 'accounts' | 'notice'>

const listing = ({ accounts, notice }: AccountListing): AccountListing => ({ accounts, notice })

// A Binding's summary names its Account's state, so a new listing is a new reading of Bindings too.
export function storeListing(client: QueryClient, next: AccountListing): void {
  client.setQueryData(QUERY_KEYS.accounts, listing(next))
  void client.invalidateQueries({ queryKey: QUERY_KEYS.tickets })
}

export function useAccounts() {
  return useQuery({
    queryKey: QUERY_KEYS.accounts,
    queryFn: async () =>
      listing(await settle(window.argo.listAccounts(accountAction('account.list')))),
  })
}

function useListingAction<Input>(act: (input: Input) => Promise<AccountListReply>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: Input) => settle(act(input)),
    onSuccess: (next) => storeListing(client, next),
  })
}

export const useDisconnect = () =>
  useListingAction((accountId: string) =>
    window.argo.disconnectAccount(disconnectRequest(accountId)),
  )

export const useDismissNotice = () =>
  useListingAction(() => window.argo.dismissAccountNotice(accountAction('account.dismiss-notice')))
