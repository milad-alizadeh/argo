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
} from '../contract/messages'

export const ACCOUNT_CHANNEL = 'argo:account'

// `revoked` is GitHub refusing the stored grant and `unreadable` is this computer unable to open it;
// either way the Account stays, its Bindings drawn at Account scope to show what it affects.
const accountSummary = z.strictObject({
  id: identifier,
  provider: z.literal('github'),
  login: identifier,
  state: z.enum(['connected', 'revoked', 'unreadable']),
  bindings: z.array(
    z.strictObject({ projectId: identifier, projectName: z.string(), scope: identifier }),
  ),
})

// `notice` is the one-time notice that the desktop needs its own sign-in (#1763). It is shown to
// everyone once, because only a keychain read could tell who had Accounts in the Swift app.
const listing = { accounts: z.array(accountSummary), notice: z.boolean() }
const listed = message('account.listed', listing)

// What the person types on GitHub's page. The device code stays in the main process.
const challenge = message('account.challenge', {
  userCode: identifier,
  verificationUri: z.string().refine((value) => URL.canParse(value)),
  expiresAt: z.number(),
})

// `renewed` is a sign-in as an identity already connected: one Account, with a fresh grant.
const connected = message('account.connected', {
  ...listing,
  accountId: identifier,
  outcome: z.enum(['added', 'renewed']),
}).refine((reply) => reply.accounts.some((account) => account.id === reply.accountId))

const disconnectRequest = message('account.disconnect', { accountId: identifier })

type Action<Type extends string> = { version: 1; type: Type; requestId: string }

export type AccountSummary = z.infer<typeof accountSummary>
export type AccountBinding = AccountSummary['bindings'][number]
export type AccountState = AccountSummary['state']
export type AccountListRequest = Action<'account.list'>
export type AccountConnectRequest = Action<'account.connect'>
export type AccountVerifyRequest = Action<'account.verify'>
export type AccountAwaitRequest = Action<'account.await'>
export type AccountCancelRequest = Action<'account.cancel'>
export type AccountDismissNoticeRequest = Action<'account.dismiss-notice'>
export type AccountDisconnectRequest = z.infer<typeof disconnectRequest>
export type AccountListed = z.infer<typeof listed>
export type AccountChallenge = z.infer<typeof challenge>
export type AccountConnected = z.infer<typeof connected>

export const ACCOUNT_ERRORS = {
  'access-denied': 'Argo cannot manage Accounts for this window.',
  'invalid-request': 'The Account request is invalid.',
  'unsupported-version': 'This Account contract version is not supported.',
  'invalid-response': 'Argo received an invalid Account response.',
  'connection-lost': 'The connection to Argo was lost.',
  'secure-storage-unavailable': 'This computer cannot store a GitHub sign-in securely.',
  'github-unreachable': 'Argo cannot reach GitHub.',
  'rate-limited': 'GitHub is limiting requests. Try again in a few minutes.',
  'sign-in-declined': 'The GitHub sign-in was declined.',
  'sign-in-expired': 'The GitHub code expired before it was entered. Start again.',
  'sign-in-cancelled': 'The GitHub sign-in was cancelled.',
  'sign-in-refused': 'GitHub refused the sign-in.',
  'no-sign-in': 'No GitHub sign-in is in progress.',
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
const accountErrorSchema = errorSchema('account.error', ACCOUNT_ERRORS)

// An action with no fields beyond the shared three.
export const isAccountAction = <Type extends string>(type: Type) => guard(message(type, {}))
export const isAccountDisconnectRequest = guard(disconnectRequest)
export const isAccountError = guard(accountErrorSchema)
export const isAccountListReply = guard(z.union([listed, accountErrorSchema]))
export const isAccountChallengeReply = guard(z.union([challenge, accountErrorSchema]))
export const isAccountConnectReply = guard(z.union([connected, accountErrorSchema]))
