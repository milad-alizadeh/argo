// The version 1 Harness sign-in contract (CONTEXT.md L1 · Harness). Readiness and sign-in for the
// vendor CLIs Argo drives — Claude and Codex — kept apart from Account: a Harness sign-in is a
// subscription to a vendor's own CLI, never an Account entity (#2579).
import { z } from 'zod'
import { projectSetupHarnesses } from '@/domains/projects/contract/project-setup-harness'
import { type ContractError, errorFactory, errorSchema, guard, message } from '@/shared/messages'

export const harnessSchema = z.enum(projectSetupHarnesses)
export type Harness = z.infer<typeof harnessSchema>

export const HARNESS_READINESS_STATES = [
  'missing',
  'signed-out',
  'ready',
  'policy-blocked',
] as const
export const harnessReadinessStateSchema = z.enum(HARNESS_READINESS_STATES)
export type HarnessReadinessState = z.infer<typeof harnessReadinessStateSchema>

// `detail` names the reason behind a state the state alone cannot say: the policy path Claude's
// CLI reports instead of `firstParty`, or why Codex's status text did not parse.
const harnessReadinessSchema = z.strictObject({
  harness: harnessSchema,
  state: harnessReadinessStateSchema,
  detail: z.string().nullable(),
})
export type HarnessReadiness = z.infer<typeof harnessReadinessSchema>

export const harnessReadinessListRequestSchema = message('harness-readiness.list', {})
export const harnessReadinessListedSchema = message('harness-readiness.listed', {
  harnesses: z.array(harnessReadinessSchema),
})

export const HARNESS_SIGN_IN_STATUSES = [
  'pending',
  'ready',
  'canceled',
  'expired',
  'failed',
] as const
export const harnessSignInStatusSchema = z.enum(HARNESS_SIGN_IN_STATUSES)
export type HarnessSignInStatus = z.infer<typeof harnessSignInStatusSchema>

const harnessSignInSnapshotShape = {
  harness: harnessSchema,
  status: harnessSignInStatusSchema,
  expiresAt: z.number().nullable(),
}
const harnessSignInSnapshot = z.strictObject(harnessSignInSnapshotShape)
export type HarnessSignInSnapshot = z.infer<typeof harnessSignInSnapshot>

export const harnessSignInStartRequestSchema = message('harness-sign-in.start', {
  harness: harnessSchema,
})
export const harnessSignInStartedSchema = message(
  'harness-sign-in.started',
  harnessSignInSnapshotShape,
)

export const harnessSignInWaitRequestSchema = message('harness-sign-in.wait', {
  harness: harnessSchema,
})
export const harnessSignInResolvedSchema = message('harness-sign-in.resolved', {
  ...harnessSignInSnapshotShape,
  readiness: harnessReadinessSchema.nullable(),
})

export const harnessSignInCancelRequestSchema = message('harness-sign-in.cancel', {
  harness: harnessSchema,
})
export const harnessSignInCanceledSchema = message(
  'harness-sign-in.canceled',
  harnessSignInSnapshotShape,
)

export type HarnessReadinessListRequest = z.infer<typeof harnessReadinessListRequestSchema>
export type HarnessReadinessListed = z.infer<typeof harnessReadinessListedSchema>
export type HarnessSignInStartRequest = z.infer<typeof harnessSignInStartRequestSchema>
export type HarnessSignInStarted = z.infer<typeof harnessSignInStartedSchema>
export type HarnessSignInWaitRequest = z.infer<typeof harnessSignInWaitRequestSchema>
export type HarnessSignInResolved = z.infer<typeof harnessSignInResolvedSchema>
export type HarnessSignInCancelRequest = z.infer<typeof harnessSignInCancelRequestSchema>
export type HarnessSignInCanceled = z.infer<typeof harnessSignInCanceledSchema>

export const HARNESS_SIGN_IN_ERRORS = {
  'access-denied': 'Argo cannot manage Harness sign-in for this window.',
  'invalid-request': 'The Harness sign-in request is invalid.',
  'unsupported-version': 'This Harness sign-in contract version is not supported.',
  'invalid-response': 'Argo received an invalid Harness sign-in response.',
  'connection-lost': 'The connection to Argo was lost.',
  'no-sign-in': 'No sign-in is in progress for this Harness.',
} as const
export type HarnessSignInErrorCode = keyof typeof HARNESS_SIGN_IN_ERRORS
export type HarnessSignInError = ContractError<'harness-sign-in.error', HarnessSignInErrorCode>
export const harnessSignInError = errorFactory('harness-sign-in.error', HARNESS_SIGN_IN_ERRORS)
export const harnessSignInErrorSchema = errorSchema('harness-sign-in.error', HARNESS_SIGN_IN_ERRORS)

export type HarnessReadinessListReply = HarnessReadinessListed | HarnessSignInError
export type HarnessSignInStartReply = HarnessSignInStarted | HarnessSignInError
export type HarnessSignInWaitReply = HarnessSignInResolved | HarnessSignInError
export type HarnessSignInCancelReply = HarnessSignInCanceled | HarnessSignInError

export const isHarnessReadinessListReply = guard(
  z.union([harnessReadinessListedSchema, harnessSignInErrorSchema]),
)
export const isHarnessSignInStartReply = guard(
  z.union([harnessSignInStartedSchema, harnessSignInErrorSchema]),
)
export const isHarnessSignInWaitReply = guard(
  z.union([harnessSignInResolvedSchema, harnessSignInErrorSchema]),
)
export const isHarnessSignInCancelReply = guard(
  z.union([harnessSignInCanceledSchema, harnessSignInErrorSchema]),
)
