import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { claudePermissionSchema } from './claude-contract'

// One drive request table for every CLI (#2030): `start` names its CLI, and every other drive
// operation routes by the Session's owner, resolved from the reader's owner lookup.
export const sessionStartRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.start'),
  requestId: identifierSchema,
  cli: z.string().min(1),
  cwd: z.string().min(1),
  prompt: z.string().refine((value) => value.trim().length > 0),
  setup: z.unknown().optional(),
})
export type SessionStartRequest = z.infer<typeof sessionStartRequestSchema>

export const sessionStartedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.started'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionStarted = z.infer<typeof sessionStartedSchema>

export const sessionSendRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.send'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  prompt: z.string().refine((value) => value.trim().length > 0),
  setup: z.unknown().optional(),
})
export type SessionSendRequest = z.infer<typeof sessionSendRequestSchema>

export const sessionInterruptRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.interrupt'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionInterruptRequest = z.infer<typeof sessionInterruptRequestSchema>

export const sessionCompactRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.compact'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionCompactRequest = z.infer<typeof sessionCompactRequestSchema>

export const sessionAcceptedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.accepted'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionAccepted = z.infer<typeof sessionAcceptedSchema>

export const sessionPermissionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.permission'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionPermissionRequest = z.infer<typeof sessionPermissionRequestSchema>

export const sessionPermissionReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.permission.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permission: claudePermissionSchema.nullable(),
})
export type SessionPermissionRead = z.infer<typeof sessionPermissionReadSchema>

export const sessionPermissionDecisionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.permission.decide'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permissionId: identifierSchema,
  decision: z.enum(['allow', 'deny']),
})
export type SessionPermissionDecisionRequest = z.infer<
  typeof sessionPermissionDecisionRequestSchema
>
