// The two read operations every renderer holds for observed Sessions: the roster and one
// Session's feed, split out of contract.ts to keep each file under the line ceiling.
import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { sessionFeedRowSchema, sessionRosterRowSchema } from './models'
import { sessionErrorSchema } from './session-error'

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
  // The Subagent whose own Feed is wanted, named by the call that spawned it, or null for the
  // Session's own Feed (#1582). A Subagent records a transcript of its own beside the Session's,
  // and its rows are the Session's sidechain, so the two are separate documents.
  delegationId: identifierSchema.nullable(),
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
export type SessionListReply = z.infer<typeof sessionListReplySchema>
export type SessionFeedReply = z.infer<typeof sessionFeedReplySchema>
