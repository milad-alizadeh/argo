// The Session IPC contract: two read operations every renderer holds for observed Sessions, and
// the one shared drive operation table every CLI answers through (ADR-0024, #2030). Named
// operations only: the renderer never receives the IPC object or picks a channel.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { sessionAttachmentInputSchema } from './attachments-contract'
import { permissionSchema, READER_DECISIONS } from './permission'
import { sessionErrorSchema } from './session-error'

export * from './archive-contract'
export * from './attachments-contract'
export * from './background-work-contract'
export * from './claude-contract'
export * from './feed-contract'
export * from './file-contract'
export * from './handoff-contract'
export * from './permission'
export * from './question-contract'
export * from './rename-contract'
export * from './search-contract'
export * from './session-error'
export * from './skill-contract'
export * from './ticket-link-contract'

// One drive request table for every CLI (#2030): `start` names its CLI, and every other drive
// operation routes by the Session's owner, resolved from the reader's owner lookup.
export const sessionStartRequestSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('session.start'),
    requestId: identifierSchema,
    cli: z.string().min(1),
    cwd: z.string().min(1),
    prompt: z.string(),
    setup: z.unknown().optional(),
    attachments: z.array(sessionAttachmentInputSchema).optional(),
  })
  .refine(({ prompt, attachments }) => prompt.trim().length > 0 || (attachments?.length ?? 0) > 0)
export type SessionStartRequest = z.infer<typeof sessionStartRequestSchema>

export const sessionStartedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.started'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionStarted = z.infer<typeof sessionStartedSchema>

export const sessionSendRequestSchema = z
  .strictObject({
    version: z.literal(1),
    type: z.literal('session.send'),
    requestId: identifierSchema,
    sessionId: identifierSchema,
    prompt: z.string(),
    setup: z.unknown().optional(),
    attachments: z.array(sessionAttachmentInputSchema).optional(),
  })
  .refine(({ prompt, attachments }) => prompt.trim().length > 0 || (attachments?.length ?? 0) > 0)
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
  permission: permissionSchema.nullable(),
})
export type SessionPermissionRead = z.infer<typeof sessionPermissionReadSchema>

export const sessionPermissionDecisionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.permission.decide'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permissionId: identifierSchema,
  decision: z.enum(READER_DECISIONS),
})
export type SessionPermissionDecisionRequest = z.infer<
  typeof sessionPermissionDecisionRequestSchema
>

export const sessionStartReplySchema = z.union([sessionStartedSchema, sessionErrorSchema])
export const sessionAcceptedReplySchema = z.union([sessionAcceptedSchema, sessionErrorSchema])
export const sessionPermissionReplySchema = z.union([
  sessionPermissionReadSchema,
  sessionErrorSchema,
])

export type SessionStartReply = z.infer<typeof sessionStartReplySchema>
export type SessionAcceptedReply = z.infer<typeof sessionAcceptedReplySchema>
export type SessionPermissionReply = z.infer<typeof sessionPermissionReplySchema>

// This table is the Session IPC contract. Adding an operation means adding its four wire facts
// here and one handler; clients and bridges select this entry rather than maintaining a second
// channel or operation list.
