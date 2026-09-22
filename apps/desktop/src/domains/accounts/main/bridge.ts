// The Account channel's main-process end. Every provider call and every credential stays behind it:
// the renderer names an action and receives secret-free records (#1763).
import type { BrowserWindow } from 'electron'
import { accountError } from '@/domains/accounts/contract/contract'
import { ACCOUNT_OPERATIONS } from '@/domains/accounts/contract/operations'
import type { AccountAccess } from '@/domains/accounts/main/access'
import { disconnect, dismissNotice, listed } from '@/domains/accounts/main/listing'
import { createSignIn } from '@/domains/accounts/main/sign-in'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'

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
