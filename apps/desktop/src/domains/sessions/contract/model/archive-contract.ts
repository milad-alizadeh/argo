import { z } from 'zod'
import { sessionRosterRowSchema } from '@/domains/sessions/contract/model/models'
import { sessionErrorSchema } from '@/domains/sessions/contract/model/session-error'
import { identifierSchema } from '@/shared/validation'

// A page of the reader's Archived Sessions, read on demand rather than every poll (#1593): the
// active list never carries one of these rows. `cursor` is opaque and echoed back to ask for the
// next page; its absence on the reply means there is no next page. `restoreId` names a Session
// the caller already has selected (from a restored route or a persisted choice) so its row comes
// back even when it falls outside the requested page — the Archive section can then open already
// showing it rather than making a reader page through hundreds of rows to find it.
export const sessionArchiveListRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.archive.list'),
  requestId: identifierSchema,
  cursor: z.string().nullable(),
  restoreId: identifierSchema.nullable(),
})
export type SessionArchiveListRequest = z.infer<typeof sessionArchiveListRequestSchema>

export const sessionArchiveListedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.archive.listed'),
  requestId: identifierSchema,
  sessions: z.array(sessionRosterRowSchema),
  nextCursor: z.string().nullable(),
  restored: sessionRosterRowSchema.nullable(),
  // False while a source's Session index still has older history to backfill (#2373, #2374), so
  // the reader never presents a page the index has not finished catching up to as the whole
  // Archive.
  historyComplete: z.boolean(),
})
export type SessionArchiveListed = z.infer<typeof sessionArchiveListedSchema>

export const sessionArchiveListReplySchema = z.union([
  sessionArchiveListedSchema,
  sessionErrorSchema,
])
export type SessionArchiveListReply = z.infer<typeof sessionArchiveListReplySchema>

// Setting the archive flag for one or more Sessions at once (#2194): `archived: true` archives
// the named Sessions, `false` restores them. `sessionIds` names the reader's own stable ids. The
// flag is Argo's own (#2315), so a Session it has never discovered archives under the id the
// caller named, and `failed` reports a storage failure alone.
export const sessionArchiveSetRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.archive.set'),
  requestId: identifierSchema,
  sessionIds: z.array(identifierSchema).min(1),
  archived: z.boolean(),
})
export type SessionArchiveSetRequest = z.infer<typeof sessionArchiveSetRequestSchema>

export const sessionArchiveAppliedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.archive.applied'),
  requestId: identifierSchema,
  archived: z.boolean(),
  applied: z.array(identifierSchema),
  failed: z.array(identifierSchema),
})
export type SessionArchiveApplied = z.infer<typeof sessionArchiveAppliedSchema>

export const sessionArchiveSetReplySchema = z.union([
  sessionArchiveAppliedSchema,
  sessionErrorSchema,
])
export type SessionArchiveSetReply = z.infer<typeof sessionArchiveSetReplySchema>
