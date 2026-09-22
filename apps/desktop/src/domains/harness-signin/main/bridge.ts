// The Harness sign-in channel's main-process end (#2579): a readiness reading and one Harness's
// own sign-in attempt, held here and never exposed as an Account.
import type { BrowserWindow } from 'electron'
import type { Harness } from '@/domains/harness-signin/contract/contract'
import { harnessSignInError } from '@/domains/harness-signin/contract/contract'
import { HARNESS_SIGN_IN_OPERATIONS } from '@/domains/harness-signin/contract/operations'
import { HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV } from '@/domains/harness-signin/contract/proof-protocol'
import { listHarnessReadiness } from '@/domains/harness-signin/main/harness-readiness-list'
import {
  createHarnessSignIn,
  type HarnessSignInDriver,
} from '@/domains/harness-signin/main/harness-sign-in'
import {
  canceledReply,
  resolvedReply,
  startedReply,
} from '@/domains/harness-signin/main/harness-sign-in-replies'
import type { HarnessReadinessRegistration } from '@/domains/harness-signin/main'
import { registerDomainHandlers } from '@/platform/main/ipc/register-domain-handlers'

export type HarnessSignInContext = {
  registrations: readonly HarnessReadinessRegistration[]
  signIn: ReturnType<typeof createHarnessSignIn>
}

export function createHarnessSignInContext(
  registrations: readonly HarnessReadinessRegistration[],
  options: { expiresAfterMs?: number } = {},
): HarnessSignInContext {
  const drivers = Object.fromEntries(
    registrations.map((registration) => [registration.harness, registration.signIn]),
  ) as Record<Harness, HarnessSignInDriver>
  return { registrations, signIn: createHarnessSignIn(drivers, options) }
}

export function attachHarnessSignInBridge(
  window: BrowserWindow,
  options: {
    registrations: readonly HarnessReadinessRegistration[]
    rendererURL: string
    proofEnabled?: boolean
  },
): HarnessSignInContext {
  // Read only on a proof run, mirroring the Session-drive seam's own proof env reads.
  const expiresAfterMsRaw = options.proofEnabled
    ? process.env[HARNESS_SIGNIN_EXPIRES_AFTER_MS_ENV]
    : undefined
  const expiresAfterMs = expiresAfterMsRaw === undefined ? undefined : Number(expiresAfterMsRaw)
  const context = createHarnessSignInContext(options.registrations, { expiresAfterMs })
  registerDomainHandlers({
    window,
    rendererURL: options.rendererURL,
    operations: HARNESS_SIGN_IN_OPERATIONS,
    context,
    handlers: {
      list: (request, { registrations }) => listHarnessReadiness(registrations, request.requestId),
      start: (request, { signIn }) =>
        startedReply(request.requestId, signIn.start(request.harness)),
      wait: async (request, { signIn }) => {
        const result = await signIn.wait(request.harness)
        if (!result) return harnessSignInError('no-sign-in', request.requestId)
        return resolvedReply(request.requestId, result.snapshot, result.readiness)
      },
      cancel: async (request, { signIn }) =>
        canceledReply(request.requestId, await signIn.cancel(request.harness)),
    },
    error: harnessSignInError,
  })
  window.on('closed', () => context.signIn.dispose())
  return context
}
