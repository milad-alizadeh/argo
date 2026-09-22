// Builds each Harness sign-in reply with its literal `version`/`type` intact — an inline object
// spreading a snapshot loses that literal narrowing, so every reply is built through here.
import type {
  HarnessReadiness,
  HarnessSignInCanceled,
  HarnessSignInResolved,
  HarnessSignInSnapshot,
  HarnessSignInStarted,
} from '@/domains/harness-signin/contract/contract'

export function startedReply(
  requestId: string,
  snapshot: HarnessSignInSnapshot,
): HarnessSignInStarted {
  return { version: 1, type: 'harness-sign-in.started', requestId, ...snapshot }
}

export function resolvedReply(
  requestId: string,
  snapshot: HarnessSignInSnapshot,
  readiness: HarnessReadiness | null,
): HarnessSignInResolved {
  return { version: 1, type: 'harness-sign-in.resolved', requestId, ...snapshot, readiness }
}

export function canceledReply(
  requestId: string,
  snapshot: HarnessSignInSnapshot,
): HarnessSignInCanceled {
  return { version: 1, type: 'harness-sign-in.canceled', requestId, ...snapshot }
}
