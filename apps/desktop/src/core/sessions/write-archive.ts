// Setting the archived flag for one or more Sessions at once (#2194). One adapter answers it: the
// others have no archive of their own, and every requested id comes back failed rather than an
// error, the same degrade `read-archive-list.ts` uses for the read side.
import { sessionArchiveSetRequestSchema, sessionError } from './contract'
import { versionFailure } from './read-request'
import type { SessionSource } from './session-source'

export async function archiveSetReply(sources: SessionSource[], value: unknown) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionArchiveSetRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const source = sources.find((candidate) => candidate.setArchived !== undefined)
  const result =
    source?.setArchived === undefined
      ? { applied: [], failed: parsed.data.sessionIds }
      : await source.setArchived({ ids: parsed.data.sessionIds, archived: parsed.data.archived })
  return {
    version: 1 as const,
    type: 'session.archive.applied' as const,
    requestId: parsed.data.requestId,
    archived: parsed.data.archived,
    applied: result.applied,
    failed: result.failed,
  }
}
