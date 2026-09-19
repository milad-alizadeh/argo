import {
  accountAwaitRequestSchema,
  accountCancelRequestSchema,
  accountChallengeSchema,
  accountConnectedSchema,
  accountConnectRequestSchema,
  accountDisconnectRequestSchema,
  accountDismissNoticeRequestSchema,
  accountErrorSchema,
  accountListedSchema,
  accountListRequestSchema,
  accountVerifyRequestSchema,
} from '@/domains/accounts/contract/contract'

// The Account IPC contract has seven named operations, each on its own channel. The table is
// consumed by the client, the preload bridge and the main-process registration, so an operation
// cannot acquire a second hand-maintained channel.
export const ACCOUNT_OPERATIONS = {
  list: {
    name: 'account.list',
    channel: 'argo:account:list',
    request: accountListRequestSchema,
    reply: accountListedSchema.or(accountErrorSchema),
  },
  connect: {
    name: 'account.connect',
    channel: 'argo:account:connect',
    request: accountConnectRequestSchema,
    reply: accountChallengeSchema.or(accountErrorSchema),
  },
  verify: {
    name: 'account.verify',
    channel: 'argo:account:verify',
    request: accountVerifyRequestSchema,
    reply: accountChallengeSchema.or(accountErrorSchema),
  },
  await: {
    name: 'account.await',
    channel: 'argo:account:await',
    request: accountAwaitRequestSchema,
    reply: accountConnectedSchema.or(accountErrorSchema),
  },
  cancel: {
    name: 'account.cancel',
    channel: 'argo:account:cancel',
    request: accountCancelRequestSchema,
    reply: accountListedSchema.or(accountErrorSchema),
  },
  dismissNotice: {
    name: 'account.dismiss-notice',
    channel: 'argo:account:dismiss-notice',
    request: accountDismissNoticeRequestSchema,
    reply: accountListedSchema.or(accountErrorSchema),
  },
  disconnect: {
    name: 'account.disconnect',
    channel: 'argo:account:disconnect',
    request: accountDisconnectRequestSchema,
    reply: accountListedSchema.or(accountErrorSchema),
  },
} as const
