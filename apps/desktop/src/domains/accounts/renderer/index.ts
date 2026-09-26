// The renderer capabilities other product domains may use. Account feature internals stay private.
export {
  AccountsDialog,
  AccountsPanel,
  type AccountsPanelProps,
} from './components/accounts-dialog'
export {
  SignInNotice,
  type SignInNoticeProps,
} from './components/sign-in-notice'
export {
  type AccountListing,
  useAccounts,
  useDismissNotice,
} from './hooks/use-accounts'
export {
  capitalized,
  providerPresentation,
} from './lib/providers'
export {
  useAccountsDialog,
  useOpenAccountsDialog,
} from './state/use-accounts-dialog'
