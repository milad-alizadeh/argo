import { z } from 'zod'
import { sessionCommandSchema } from '@/domains/sessions/next/contract/session-command-contract'
import { sessionIdentitySchema } from '@/domains/sessions/next/contract/session-contract'
import {
  sessionCommandOutcomeSchema,
  sessionProjectionSchema,
} from '@/domains/sessions/next/contract/session-projection-contract'
import { identifierSchema } from '@/shared/validation'

export const managedSessionCommandRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('managed-session.command'),
  requestId: identifierSchema,
  command: sessionCommandSchema,
})
export type ManagedSessionCommandRequest = z.infer<typeof managedSessionCommandRequestSchema>

export const managedSessionSubscribeRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('managed-session.subscribe'),
  requestId: identifierSchema,
  session: sessionIdentitySchema,
})

export const managedSessionOutcomeSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('managed-session.outcome'),
  requestId: identifierSchema,
  outcome: sessionCommandOutcomeSchema,
})
export type ManagedSessionOutcome = z.infer<typeof managedSessionOutcomeSchema>

export const managedSessionSubscribedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('managed-session.subscribed'),
  requestId: identifierSchema,
})

export const managedSessionErrorSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('managed-session.error'),
  requestId: identifierSchema.nullable(),
  code: z.enum([
    'access-denied',
    'unsupported-version',
    'invalid-request',
    'invalid-response',
    'connection-lost',
  ]),
})
export type ManagedSessionError = z.infer<typeof managedSessionErrorSchema>

export const managedSessionReplySchema = managedSessionOutcomeSchema.or(managedSessionErrorSchema)
export type ManagedSessionReply = z.infer<typeof managedSessionReplySchema>

export const managedSessionSubscribeReplySchema =
  managedSessionSubscribedSchema.or(managedSessionErrorSchema)

export const managedSessionProjectionEventSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('managed-session.projection'),
  requestId: z.literal('subscription'),
  projection: sessionProjectionSchema,
})
