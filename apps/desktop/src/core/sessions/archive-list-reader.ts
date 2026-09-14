// Reply-building for `session.archive.list`, pulled out of reader.ts to keep that file under the
// line cap.
import { sessionArchiveListRequestSchema, sessionError } from './contract'
import { versionFailure } from './reader'
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
