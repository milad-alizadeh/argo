// The archived-Session page. One adapter answers it: the others have no archive of their own, and
// an empty page is the honest reply rather than an error.
import { sessionArchiveListRequestSchema, sessionError } from './contract'
import { versionFailure } from './read-request'
import type { SessionSource } from './session-source'

export async function archiveListReply(sources: SessionSource[], value: unknown) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionArchiveListRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const source = sources.find((candidate) => candidate.discoverArchivedSessions !== undefined)
  const page =
    source?.discoverArchivedSessions === undefined
      ? { rows: [], nextCursor: null, restored: null }
      : await source.discoverArchivedSessions({
          cursor: parsed.data.cursor,
          restoreId: parsed.data.restoreId,
        })
  return {
    version: 1 as const,
    type: 'session.archive.listed' as const,
    requestId: parsed.data.requestId,
    sessions: page.rows,
    nextCursor: page.nextCursor,
    restored: page.restored,
  }
}
