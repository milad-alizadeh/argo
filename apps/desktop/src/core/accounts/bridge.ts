// The Account channel's main-process end. Every provider call and every credential stays behind it:
// the renderer names an action and receives secret-free records (#1763).
import type { BrowserWindow } from 'electron'
import { registerDomainHandlers } from '../contract/domain'
import type { AccountAccess } from './access'
import { accountError } from './contract'
import { disconnect, dismissNotice, listed } from './listing'
import { ACCOUNT_OPERATIONS } from './operations'
import { createSignIn } from './sign-in'

export type AccountContext = { access: AccountAccess; signIn: ReturnType<typeof createSignIn> }

export const createAccountContext = (access: AccountAccess): AccountContext => ({
  access,
  signIn: createSignIn(access),
})

export function attachAccountBridge(
  window: BrowserWindow,
  options: { access: AccountAccess; rendererURL: string },
): AccountContext {
  const context = createAccountContext(options.access)
  registerDomainHandlers({
    window,
    rendererURL: options.rendererURL,
    operations: ACCOUNT_OPERATIONS,
    context,
    handlers: {
      list: (request, { access }) => listed(access, request.requestId),
      connect: (request, { signIn }) => signIn.connect(request.requestId, request.provider),
      verify: (request, { signIn }) => signIn.verify(request.requestId),
      await: (request, { signIn }) => signIn.wait(request.requestId),
      cancel: (request, { signIn }) => signIn.cancel(request.requestId),
      dismissNotice: (request, { access }) => dismissNotice(access, request.requestId),
      disconnect: (request, { access }) => disconnect(access, request.requestId, request.accountId),
    },
    error: accountError,
  })
  window.on('closed', () => context.signIn.dispose())
  return context
}
