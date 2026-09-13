// The two operations the renderer holds for observed Sessions, and the shapes both sides parse.
// Named operations only: the renderer never receives the IPC object or picks a channel.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { sessionFeedRowSchema, sessionRosterRowSchema } from './models'
import { sessionErrorSchema } from './session-error'

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

export const claudeSessionStartRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.start'),
  requestId: identifierSchema,
  cwd: z.string().min(1),
  prompt: z.string().refine((value) => value.trim().length > 0),
})
export type ClaudeSessionStartRequest = z.infer<typeof claudeSessionStartRequestSchema>

export const claudeSessionStartedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.started'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionStarted = z.infer<typeof claudeSessionStartedSchema>

export const claudeSessionSendRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.send'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  prompt: z.string().refine((value) => value.trim().length > 0),
})
export type ClaudeSessionSendRequest = z.infer<typeof claudeSessionSendRequestSchema>

export const claudeSessionInterruptRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.interrupt'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionInterruptRequest = z.infer<typeof claudeSessionInterruptRequestSchema>

export const claudeSessionAcceptedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.accepted'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionAccepted = z.infer<typeof claudeSessionAcceptedSchema>

export const claudePermissionSchema = z.strictObject({
  id: identifierSchema,
  sessionId: identifierSchema,
  toolName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
})
export type ClaudePermission = z.infer<typeof claudePermissionSchema>
export const claudeSessionPermissionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type ClaudeSessionPermissionRequest = z.infer<typeof claudeSessionPermissionRequestSchema>
export const claudeSessionPermissionReadSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission.read'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permission: claudePermissionSchema.nullable(),
})
export type ClaudeSessionPermissionRead = z.infer<typeof claudeSessionPermissionReadSchema>
export const claudeSessionPermissionDecisionRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.claude.permission.decide'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  permissionId: identifierSchema,
  decision: z.enum(['allow', 'deny']),
})
export type ClaudeSessionPermissionDecisionRequest = z.infer<
  typeof claudeSessionPermissionDecisionRequestSchema
>

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

export const sessionListReplySchema = z.union([sessionsListedSchema, sessionErrorSchema])
export const sessionFeedReplySchema = z.union([
  sessionFeedReadSchema,
  sessionFeedUnchangedSchema,
  sessionErrorSchema,
])
export const claudeSessionStartReplySchema = z.union([
  claudeSessionStartedSchema,
  sessionErrorSchema,
])
export const claudeSessionSendReplySchema = z.union([
  claudeSessionAcceptedSchema,
  sessionErrorSchema,
])
export const claudeSessionPermissionReplySchema = z.union([
  claudeSessionPermissionReadSchema,
  sessionErrorSchema,
])

export type SessionListReply = z.infer<typeof sessionListReplySchema>
export type SessionFeedReply = z.infer<typeof sessionFeedReplySchema>
export type ClaudeSessionStartReply = z.infer<typeof claudeSessionStartReplySchema>
export type ClaudeSessionSendReply = z.infer<typeof claudeSessionSendReplySchema>
export type ClaudeSessionInterruptReply = z.infer<typeof claudeSessionSendReplySchema>
export type ClaudeSessionPermissionReply = z.infer<typeof claudeSessionPermissionReplySchema>
export type ClaudeSessionPermissionDecisionReply = z.infer<typeof claudeSessionSendReplySchema>

// This table is the Session IPC contract. Adding an operation means adding its four wire facts
// here and one handler; clients and bridges select this entry rather than maintaining a second
// channel or operation list.
