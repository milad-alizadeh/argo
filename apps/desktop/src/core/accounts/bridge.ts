// The Account channel's main-process end. Every GitHub call and every credential stays behind it:
// the renderer names an action and receives secret-free records (#1763).
import type { BrowserWindow } from 'electron'
import { requestIdentifier } from '../../boundary'
import { createRouter } from '../contract/messages'
import { isTrustedRendererFrame } from '../security/is-trusted-renderer-frame'
import type { AccountAccess } from './access'
import {
  ACCOUNT_CHANNEL,
  type AccountError,
  accountError,
  isAccountAction,
  isAccountDisconnectRequest,
} from './contract'
import { disconnect, dismissNotice, listed } from './listing'
import { createSignIn } from './sign-in'

export type AccountContext = { access: AccountAccess; signIn: ReturnType<typeof createSignIn> }
type Context = AccountContext

export const createAccountContext = (access: AccountAccess): AccountContext => ({
  access,
  signIn: createSignIn(access),
})

// An action with no fields beyond the shared three, answered by one call.
const bare = (type: string, answer: (context: Context, requestId: string) => Promise<unknown>) => {
  const accept = isAccountAction(type)
  return (request: unknown, context: Context) =>
    accept(request)
      ? answer(context, request.requestId)
      : accountError('invalid-request', requestIdentifier(request))
}

const HANDLERS = {
  'account.list': bare('account.list', ({ access }, requestId) => listed(access, requestId)),
  'account.connect': bare('account.connect', ({ signIn }, id) => signIn.connect(id)),
  'account.verify': bare('account.verify', ({ signIn }, id) => signIn.verify(id)),
  'account.await': bare('account.await', ({ signIn }, id) => signIn.wait(id)),
  'account.cancel': bare('account.cancel', ({ signIn }, id) => signIn.cancel(id)),
  'account.dismiss-notice': bare('account.dismiss-notice', ({ access }, id) =>
    dismissNotice(access, id),
  ),
  'account.disconnect': (request: unknown, { access }: Context) =>
    isAccountDisconnectRequest(request)
      ? disconnect(access, request.requestId, request.accountId)
      : accountError('invalid-request', requestIdentifier(request)),
}

export const routeAccountRequest = createRouter<Context, unknown>(HANDLERS, accountError)

export function attachAccountBridge(
  window: BrowserWindow,
  options: { access: AccountAccess; rendererURL: string },
): void {
  const context = createAccountContext(options.access)
  window.webContents.ipc.handle(ACCOUNT_CHANNEL, (event, request: unknown) => {
    if (!isTrustedRendererFrame(event, window, options.rendererURL)) {
      return accountError('access-denied', requestIdentifier(request)) satisfies AccountError
    }
    return routeAccountRequest(request, context)
  })
  window.on('closed', () => context.signIn.dispose())
}
