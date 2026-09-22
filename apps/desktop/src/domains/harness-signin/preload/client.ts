import type {
  Harness,
  HarnessReadinessListReply,
  HarnessSignInCancelReply,
  HarnessSignInStartReply,
  HarnessSignInWaitReply,
} from '@/domains/harness-signin/contract/contract'
import { harnessSignInError } from '@/domains/harness-signin/contract/contract'
import { HARNESS_SIGN_IN_OPERATIONS } from '@/domains/harness-signin/contract/operations'
import { createDomainClient } from '@/shared/ipc/client'

export type HarnessSignInClient = {
  listHarnessReadiness(): Promise<HarnessReadinessListReply>
  startHarnessSignIn(request: { harness: Harness }): Promise<HarnessSignInStartReply>
  waitHarnessSignIn(request: { harness: Harness }): Promise<HarnessSignInWaitReply>
  cancelHarnessSignIn(request: { harness: Harness }): Promise<HarnessSignInCancelReply>
}

export function createHarnessSignInClient(
  invoke: (channel: string, request: unknown) => Promise<unknown>,
): HarnessSignInClient {
  const client = createDomainClient(HARNESS_SIGN_IN_OPERATIONS, invoke, harnessSignInError)
  return {
    listHarnessReadiness: () => client.list(),
    startHarnessSignIn: (request) => client.start(request),
    waitHarnessSignIn: (request) => client.wait(request),
    cancelHarnessSignIn: (request) => client.cancel(request),
  }
}
