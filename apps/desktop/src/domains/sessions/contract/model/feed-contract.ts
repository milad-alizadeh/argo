// The two read operations every renderer holds for observed Sessions: the roster and one
// Session's feed, split out of contract.ts to keep each file under the line ceiling.
import { z } from 'zod'
import {
  sessionFeedRowSchema,
  sessionRosterRowSchema,
} from '@/domains/sessions/contract/model/models'
import { sessionErrorSchema } from '@/domains/sessions/contract/model/session-error'
import { identifierSchema } from '@/shared/validation'

export const sessionListRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.list'),
  requestId: identifierSchema,
  // The open cockpit window's Project root (CONTEXT.md L1 · Project), or null to read every
  // Session on the machine. A Session whose cwd does not resolve under this root belongs to a
  // different Project and is left out of the reply (#2204).
  projectRoot: z.string().nullable(),
  // The window already loaded, echoed back from a prior reply's `nextCursor`, or absent/null for
  // the bounded first page (#2239). Opaque: a caller only ever echoes what a reply gave it.
  cursor: z.string().nullable().optional(),
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
  subagentId: identifierSchema.nullable(),
  // The document the renderer already holds, if any. This keeps an unchanged reply from leaving
  // a reloaded or evicted deck without rows to draw.
  revision: z.string().nullable(),
})
export type SessionFeedRequest = z.infer<typeof sessionFeedRequestSchema>

// Switching away from a Session while its read is still in flight (#2102) sends this so the main
// process stops the settle loop instead of finishing a read nothing will draw.
export const sessionFeedCancelRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed.cancel'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
})
export type SessionFeedCancelRequest = z.infer<typeof sessionFeedCancelRequestSchema>

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
  // How many of those files the pass actually opened. Zero on a warm read through the Session
  // index, which is the difference between reaching a window and re-reading it (#2372).
  filesParsed: z.number(),
  // Opaque; echo it back as the next request's `cursor` to read a larger window. `null` means
  // every adapter has already read every file it found (#2239).
  nextCursor: z.string().nullable(),
  // False while any adapter's Session index is still backfilling older history (#2373), so a
  // reader never mistakes an index still catching up for the machine's whole history.
  historyComplete: z.boolean(),
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

// The rows a poll's revision already covers stay unsent: the caller already holds the leading
// `unchangedRowCount` rows of its own last reply, under `revision`, and keeps them in place; only
// the rows a Harness's append could still touch travel here, replacing everything after that point.
export const sessionFeedAppendedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.feed.appended'),
  requestId: identifierSchema,
  sessionId: identifierSchema,
  chainId: identifierSchema,
  revision: z.string(),
  unchangedRowCount: z.number().int().nonnegative(),
  rows: z.array(sessionFeedRowSchema),
})
export type SessionFeedAppended = z.infer<typeof sessionFeedAppendedSchema>

// The one place that turns an `appended` reply back into a whole document: the rows the caller's
// own cached read already held, up to `unchangedRowCount`, followed by what the reply carries. A
// caller with no cached read for this exact revision cannot apply the delta, so it is dropped:
// `readOwnedFeed` only ever sends `appended` to a caller whose revision it already matched, but a
// consumer that lost its cache between building the request and reading the reply falls back here
// to only what the reply itself carries, rather than drawing a Feed missing its earlier rows.
export function mergeAppendedFeed(
  cached: SessionFeedRead | null | undefined,
  reply: SessionFeedAppended,
): SessionFeedRead {
  const held = cached?.rows.slice(0, reply.unchangedRowCount) ?? []
  return {
    version: reply.version,
    type: 'session.feed.read',
    requestId: reply.requestId,
    sessionId: reply.sessionId,
    chainId: reply.chainId,
    revision: reply.revision,
    rows: [...held, ...reply.rows],
  }
}

export const sessionListReplySchema = z.union([sessionsListedSchema, sessionErrorSchema])
export const sessionFeedReplySchema = z.union([
  sessionFeedReadSchema,
  sessionFeedAppendedSchema,
  sessionFeedUnchangedSchema,
  sessionErrorSchema,
])
export type SessionListReply = z.infer<typeof sessionListReplySchema>
export type SessionFeedReply = z.infer<typeof sessionFeedReplySchema>
