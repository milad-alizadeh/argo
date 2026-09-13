// The two operations the renderer holds for observed Sessions, and the shapes both sides parse.
// Named operations only: the renderer never receives the IPC object or picks a channel.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import {
  claudeSessionAcceptedSchema,
  claudeSessionPermissionReadSchema,
  claudeSessionStartedSchema,
} from './claude-contract'
import { codexSessionAcceptedSchema, codexSessionStartedSchema } from './codex-contract'
import { sessionFeedRowSchema, sessionRosterRowSchema } from './models'
import { sessionErrorSchema } from './session-error'

export * from './claude-contract'
export * from './codex-contract'
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
export const codexSessionStartReplySchema = z.union([codexSessionStartedSchema, sessionErrorSchema])
export const codexSessionSendReplySchema = z.union([codexSessionAcceptedSchema, sessionErrorSchema])

export type SessionListReply = z.infer<typeof sessionListReplySchema>
export type SessionFeedReply = z.infer<typeof sessionFeedReplySchema>
export type ClaudeSessionStartReply = z.infer<typeof claudeSessionStartReplySchema>
export type ClaudeSessionSendReply = z.infer<typeof claudeSessionSendReplySchema>
export type ClaudeSessionInterruptReply = z.infer<typeof claudeSessionSendReplySchema>
export type ClaudeSessionPermissionReply = z.infer<typeof claudeSessionPermissionReplySchema>
export type ClaudeSessionPermissionDecisionReply = z.infer<typeof claudeSessionSendReplySchema>
export type CodexSessionStartReply = z.infer<typeof codexSessionStartReplySchema>
export type CodexSessionSendReply = z.infer<typeof codexSessionSendReplySchema>
export type CodexSessionInterruptReply = z.infer<typeof codexSessionSendReplySchema>

// This table is the Session IPC contract. Adding an operation means adding its four wire facts
// here and one handler; clients and bridges select this entry rather than maintaining a second
// channel or operation list.
