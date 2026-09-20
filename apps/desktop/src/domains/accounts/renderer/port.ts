// The renderer capabilities other product domains may use. Account feature internals stay private.
export {
  AccountsDialog,
  AccountsPanel,
  type AccountsPanelProps,
} from '@/domains/accounts/renderer/components/accounts-dialog'
export {
  SignInNotice,
  type SignInNoticeProps,
} from '@/domains/accounts/renderer/components/sign-in-notice'
export {
  type AccountListing,
  useAccounts,
  useDismissNotice,
} from '@/domains/accounts/renderer/hooks/use-accounts'
export {
  capitalized,
  providerPresentation,
} from '@/domains/accounts/renderer/lib/providers'
export {
  openAccountsDialog,
  useAccountsDialog,
} from '@/domains/accounts/renderer/state/use-accounts-dialog'
