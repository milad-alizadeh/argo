// The version 1 Account contract (CONTEXT.md L1 · Account). Every message here is secret-free by
// shape: no field carries a token, and the strict schemas refuse a reply that does (#1763).
// Shared by main and renderer, so it imports neither Electron nor Node.
import { z } from 'zod'
import {
  type ContractError,
  errorFactory,
  errorSchema,
  guard,
  identifier,
  message,
} from '../../../core/contract/messages'

export const PROVIDERS = ['github', 'linear'] as const
export const provider = z.enum(PROVIDERS)
// A person's name for display: a GitHub login, or a Linear name, which can hold spaces.
export const displayName = z.string().min(1).max(256)

// `expired` is a grant that lapsed and could not be renewed, `revoked` the provider refusing it, and
// `unreadable` this computer unable to open it; each way the Account stays, its Connections drawn at
// Account scope to show what it affects.
const accountSummary = z.strictObject({
  id: identifier,
  provider,
  login: displayName,
  workspace: z.string().nullable(),
  state: z.enum(['connected', 'expired', 'revoked', 'unreadable']),
  connections: z.array(
    z.strictObject({ projectId: identifier, projectName: z.string(), label: z.string() }),
  ),
})

// `notice` is the one-time notice that the desktop needs its own sign-in (#1763). It is shown to
// everyone once, because only a keychain read could tell who had Accounts in the Swift app.
// `providers` are the ones this build can sign in to: Linear only once its OAuth App is registered.
const listing = {
  accounts: z.array(accountSummary),
  notice: z.boolean(),
  providers: z.array(provider),
}
export const accountListedSchema = message('account.listed', listing)

export const accountConnectRequestSchema = message('account.connect', { provider })
export const accountListRequestSchema = message('account.list', {})
export const accountVerifyRequestSchema = message('account.verify', {})
export const accountAwaitRequestSchema = message('account.await', {})
export const accountCancelRequestSchema = message('account.cancel', {})
export const accountDismissNoticeRequestSchema = message('account.dismiss-notice', {})

// What the person needs to finish signing in. GitHub's is the code typed on its page; Linear's page
// needs nothing typed. The device code and the authorization URL stay in the main process.
export const accountChallengeSchema = z.discriminatedUnion('provider', [
  message('account.challenge', {
    provider: z.literal('github'),
    userCode: identifier,
    verificationUri: z.string().refine((value) => URL.canParse(value)),
    expiresAt: z.number(),
  }),
  message('account.challenge', { provider: z.literal('linear'), expiresAt: z.number() }),
])

// `renewed` is a sign-in as an identity already connected: one Account, with a fresh grant.
export const accountConnectedSchema = message('account.connected', {
  ...listing,
  accountId: identifier,
  outcome: z.enum(['added', 'renewed']),
}).refine((reply) => reply.accounts.some((account) => account.id === reply.accountId))

export const accountDisconnectRequestSchema = message('account.disconnect', {
  accountId: identifier,
})

export type AccountSummary = z.infer<typeof accountSummary>
export type AccountConnection = AccountSummary['connections'][number]
export type AccountState = AccountSummary['state']
export type Provider = z.infer<typeof provider>
export type AccountListRequest = z.infer<typeof accountListRequestSchema>
export type AccountConnectRequest = z.infer<typeof accountConnectRequestSchema>
export type AccountVerifyRequest = z.infer<typeof accountVerifyRequestSchema>
export type AccountAwaitRequest = z.infer<typeof accountAwaitRequestSchema>
export type AccountCancelRequest = z.infer<typeof accountCancelRequestSchema>
export type AccountDismissNoticeRequest = z.infer<typeof accountDismissNoticeRequestSchema>
export type AccountDisconnectRequest = z.infer<typeof accountDisconnectRequestSchema>
export type AccountListed = z.infer<typeof accountListedSchema>
export type AccountChallenge = z.infer<typeof accountChallengeSchema>
export type AccountConnected = z.infer<typeof accountConnectedSchema>

export const ACCOUNT_ERRORS = {
  'access-denied': 'Argo cannot manage Accounts for this window.',
  'invalid-request': 'The Account request is invalid.',
  'unsupported-version': 'This Account contract version is not supported.',
  'invalid-response': 'Argo received an invalid Account response.',
  'connection-lost': 'The connection to Argo was lost.',
  'secure-storage-unavailable': 'This computer cannot store a sign-in securely.',
  'provider-unavailable': 'This build of Argo cannot sign in to that service.',
  'github-unreachable': 'Argo cannot reach GitHub.',
  'rate-limited': 'GitHub is limiting requests. Try again in a few minutes.',
  'linear-unreachable': 'Argo cannot reach Linear.',
  'linear-rate-limited': 'Linear is limiting requests. Try again in a few minutes.',
  'sign-in-port-busy':
    'Another app is using the port Linear signs in through. Close it and try again.',
  'sign-in-declined': 'The sign-in was declined.',
  'sign-in-expired': 'The sign-in expired before it was finished. Start again.',
  'sign-in-cancelled': 'The sign-in was cancelled.',
  'sign-in-refused': 'The sign-in was not accepted.',
  'no-sign-in': 'No sign-in is in progress.',
  'missing-account': 'That Account is not connected.',
  'storage-invalid': 'The Account store cannot be read in this format.',
  'storage-unavailable': 'Argo cannot access the Account store.',
  'storage-not-written': 'Argo could not save the Account.',
} as const

export type AccountErrorCode = keyof typeof ACCOUNT_ERRORS
export type AccountError = ContractError<'account.error', AccountErrorCode>
export type AccountListReply = AccountListed | AccountError
export type AccountChallengeReply = AccountChallenge | AccountError
export type AccountConnectReply = AccountConnected | AccountError

export const accountError = errorFactory('account.error', ACCOUNT_ERRORS)
export const accountErrorSchema = errorSchema('account.error', ACCOUNT_ERRORS)

export const isAccountListReply = guard(z.union([accountListedSchema, accountErrorSchema]))
export const isAccountChallengeReply = guard(z.union([accountChallengeSchema, accountErrorSchema]))
export const isAccountConnectReply = guard(z.union([accountConnectedSchema, accountErrorSchema]))
