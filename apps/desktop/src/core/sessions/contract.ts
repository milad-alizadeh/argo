// The Session IPC contract: two read operations every renderer holds for observed Sessions, and
// the one shared drive operation table every CLI answers through (ADR-0024, #2030). Named
// operations only: the renderer never receives the IPC object or picks a channel.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { claudePermissionSchema } from './claude-contract'
import { sessionFeedRowSchema, sessionRosterRowSchema } from './models'
import { sessionRenamedSchema } from './rename-contract'
import { sessionErrorSchema } from './session-error'

export * from './claude-contract'
export * from './rename-contract'
export * from './session-error'

export const sessionListRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.list'),
  requestId: identifierSchema,
})
export type SessionListRequest = z.infer<typeof sessionListRequestSchema>
export const sessionFeedRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  // The document the renderer already holds, if any. This keeps an unchanged reply from leaving
  // a reloaded or evicted deck without rows to draw.
  revision: z.string().nullable(),
})
export type SessionFeedRequest = z.infer<typeof sessionFeedRequestSchema>

export const sessionsListedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.listed'),
  requestId: identifierSchema,
  sessions: z.array(sessionRosterRowSchema),
  // What the pass reached, stated rather than implied. A Roster that read 200 of 1,055 files
  // says so; one that silently showed 200 rows would read as the whole machine.
  filesFound: z.number(),
  filesRead: z.number(),
  filesUnreadable: z.number(),
})
export type SessionsListed = z.infer<typeof sessionsListedSchema>

export const sessionFeedReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed.read'),
  requestId: identifierSchema,
  // The id that was ASKED for, echoed so the caller can prove the reply is its own.
  sessionId: identifierSchema,
  // The Session that answered. A retired id follows the chain that took it, so this is not always
  // the id asked for (CONTEXT.md L2 · retired id). The renderer keys on the id it asked for; this
  // is here so a caller can tell that the two differ, and it is what the proofs assert against.
  chainId: identifierSchema,
  // A main-process token for the exact projected document this reply carries. A different
  // revision must be measured before its rows enter the viewport, even when ids stay the same.
  revision: z.string(),
  rows: z.array(sessionFeedRowSchema),
})
export type SessionFeedRead = z.infer<typeof sessionFeedReadSchema>

// The selected chain's file stamps did not move, so the main process returns this compact reply
// instead of copying an unchanged whole document over IPC on every observation pass.
export const sessionFeedUnchangedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed.unchanged'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  chainId: identifierSchema,
  revision: z.string(),
})
export type SessionFeedUnchanged = z.infer<typeof sessionFeedUnchangedSchema>

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

export const sessionListReplySchema = z.union([sessionsListedSchema, sessionErrorSchema])
export const sessionFeedReplySchema = z.union([
  sessionFeedReadSchema,
  sessionFeedUnchangedSchema,
  sessionErrorSchema,
])
export const sessionStartReplySchema = z.union([sessionStartedSchema, sessionErrorSchema])
export const sessionAcceptedReplySchema = z.union([sessionAcceptedSchema, sessionErrorSchema])
export const sessionPermissionReplySchema = z.union([
  sessionPermissionReadSchema,
  sessionErrorSchema,
])
export const sessionRenameReplySchema = z.union([sessionRenamedSchema, sessionErrorSchema])

export type SessionListReply = z.infer<typeof sessionListReplySchema>
export type SessionFeedReply = z.infer<typeof sessionFeedReplySchema>
export type SessionStartReply = z.infer<typeof sessionStartReplySchema>
export type SessionAcceptedReply = z.infer<typeof sessionAcceptedReplySchema>
export type SessionPermissionReply = z.infer<typeof sessionPermissionReplySchema>
export type SessionRenameReply = z.infer<typeof sessionRenameReplySchema>

// This table is the Session IPC contract. Adding an operation means adding its four wire facts
// here and one handler; clients and bridges select this entry rather than maintaining a second
// channel or operation list.
