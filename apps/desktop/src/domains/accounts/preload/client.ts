// The renderer's Account operations. Each reply is parsed here before a component sees it, so a
// reply carrying any field the contract does not name, a token included, never arrives.
import { createDomainClient } from '../../../shared/ipc/client'
import {
  type AccountChallengeReply,
  type AccountConnectReply,
  type AccountListReply,
  accountError,
  type Provider,
} from '../contract/contract'
import { ACCOUNT_OPERATIONS } from '../contract/operations'

export type AccountClient = {
  listAccounts(): Promise<AccountListReply>
  connectAccount(request: { provider: Provider }): Promise<AccountChallengeReply>
  verifyAccount(): Promise<AccountChallengeReply>
  awaitAccount(): Promise<AccountConnectReply>
  cancelAccount(): Promise<AccountListReply>
  disconnectAccount(request: { accountId: string }): Promise<AccountListReply>
  dismissAccountNotice(): Promise<AccountListReply>
}

export function createAccountClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): AccountClient {
  const client = createDomainClient(ACCOUNT_OPERATIONS, invoke, accountError)
  return {
    listAccounts: () => client.list(),
    connectAccount: (request) => client.connect(request),
    verifyAccount: () => client.verify(),
    awaitAccount: () => client.await(),
    cancelAccount: () => client.cancel(),
    disconnectAccount: (request) => client.disconnect(request),
    dismissAccountNotice: () => client.dismissNotice(),
  }
}
