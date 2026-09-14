import { z } from 'zod'
import { identifierSchema } from '../../boundary'
import { sessionRosterRowSchema } from './models'

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
})
export type SessionArchiveListed = z.infer<typeof sessionArchiveListedSchema>
