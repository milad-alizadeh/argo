import { z } from 'zod'
import { sessionRosterRowSchema } from '@/domains/sessions/contract/model/models'
import { sessionErrorSchema } from '@/domains/sessions/contract/model/session-error'
import { identifierSchema } from '@/shared/validation'

// Which Sessions a reading scopes to: the Roster's own filter (`use-roster-filter-store.ts`
// imports this as its canonical definition), reused here so a search request names the same
// scope the active list and the Archive already read under (#2375).
export const rosterStatusSchema = z.enum(['active', 'archived', 'all'])
export type RosterStatus = z.infer<typeof rosterStatusSchema>

// Searching by title or Session id across the complete indexed history (#2375), not just the
// rows a caller's Roster window has already loaded. `status` and `projectRoot` scope the search
// exactly as the Roster and Archive scope their own lists. `query` empty is not sent: an empty
// query answers the normal scoped Roster instead, which the renderer already reads.
export const sessionSearchRequestSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.search'),
  requestId: identifierSchema,
  projectRoot: z.string().nullable(),
  status: rosterStatusSchema,
  query: z.string().min(1),
  cursor: z.string().nullable(),
})
export type SessionSearchRequest = z.infer<typeof sessionSearchRequestSchema>

export const sessionSearchedSchema = z.strictObject({
  version: z.literal(1),
  type: z.literal('session.searched'),
  requestId: identifierSchema,
  sessions: z.array(sessionRosterRowSchema),
  nextCursor: z.string().nullable(),
  // False while a source's Session index still has older history to backfill (#2373, #2374), so
  // the renderer can say the match list is not yet the complete history.
  historyComplete: z.boolean(),
})
export type SessionSearched = z.infer<typeof sessionSearchedSchema>

export const sessionSearchReplySchema = z.union([sessionSearchedSchema, sessionErrorSchema])
export type SessionSearchReply = z.infer<typeof sessionSearchReplySchema>
