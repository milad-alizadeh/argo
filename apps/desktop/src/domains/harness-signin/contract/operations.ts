import {
  harnessReadinessListedSchema,
  harnessReadinessListRequestSchema,
  harnessSignInCanceledSchema,
  harnessSignInCancelRequestSchema,
  harnessSignInErrorSchema,
  harnessSignInResolvedSchema,
  harnessSignInStartedSchema,
  harnessSignInStartRequestSchema,
  harnessSignInWaitRequestSchema,
} from './contract'

// The Harness sign-in IPC contract: one channel for the readiness reading and one triad
// (start/wait/cancel) for a Harness's own sign-in flow, mirroring the Account operations table.
export const HARNESS_SIGN_IN_OPERATIONS = {
  list: {
    name: 'harness-readiness.list',
    channel: 'argo:harness-sign-in:list',
    request: harnessReadinessListRequestSchema,
    reply: harnessReadinessListedSchema.or(harnessSignInErrorSchema),
  },
  start: {
    name: 'harness-sign-in.start',
    channel: 'argo:harness-sign-in:start',
    request: harnessSignInStartRequestSchema,
    reply: harnessSignInStartedSchema.or(harnessSignInErrorSchema),
  },
  wait: {
    name: 'harness-sign-in.wait',
    channel: 'argo:harness-sign-in:wait',
    request: harnessSignInWaitRequestSchema,
    reply: harnessSignInResolvedSchema.or(harnessSignInErrorSchema),
  },
  cancel: {
    name: 'harness-sign-in.cancel',
    channel: 'argo:harness-sign-in:cancel',
    request: harnessSignInCancelRequestSchema,
    reply: harnessSignInCanceledSchema.or(harnessSignInErrorSchema),
  },
} as const
