// The renderer's Account operations. Each reply is parsed here before a component sees it, so a
// reply carrying any field the contract does not name, a token included, never arrives.
import { createSender } from '../contract/messages'
import {
  type AccountAwaitRequest,
  type AccountCancelRequest,
  type AccountChallengeReply,
  type AccountConnectReply,
  type AccountConnectRequest,
  type AccountDisconnectRequest,
  type AccountDismissNoticeRequest,
  type AccountError,
  type AccountListReply,
  type AccountListRequest,
  type AccountVerifyRequest,
  accountError,
  isAccountChallengeReply,
  isAccountConnectReply,
  isAccountListReply,
} from './contract'

export type AccountClient = {
  listAccounts(request: AccountListRequest): Promise<AccountListReply>
  connectAccount(request: AccountConnectRequest): Promise<AccountChallengeReply>
  verifyAccount(request: AccountVerifyRequest): Promise<AccountChallengeReply>
  awaitAccount(request: AccountAwaitRequest): Promise<AccountConnectReply>
  cancelAccount(request: AccountCancelRequest): Promise<AccountListReply>
  disconnectAccount(request: AccountDisconnectRequest): Promise<AccountListReply>
  dismissAccountNotice(request: AccountDismissNoticeRequest): Promise<AccountListReply>
}

export function createAccountClient(invoke: (request: unknown) => Promise<unknown>): AccountClient {
  const send = createSender<AccountError>(invoke, accountError)
  return {
    listAccounts: (request) => send(request, isAccountListReply),
    connectAccount: (request) => send(request, isAccountChallengeReply),
    verifyAccount: (request) => send(request, isAccountChallengeReply),
    awaitAccount: (request) => send(request, isAccountConnectReply),
    cancelAccount: (request) => send(request, isAccountListReply),
    disconnectAccount: (request) => send(request, isAccountListReply),
    dismissAccountNotice: (request) => send(request, isAccountListReply),
  }
}
