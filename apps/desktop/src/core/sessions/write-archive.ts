// Setting the archived flag for one or more Sessions at once (#2194, #2315). Argo owns the flag,
// so this writes its own store and needs no row in any other app's: a Session Argo has never
// discovered is archived under the id the caller named. `failed` is a storage failure alone.
//
// Restoring has to reach every id the Session has answered to. A Session archived before a resume
// is recorded under the id that was current then, so the window below grows until each named
// Session's row is found and its retired ids are known (#2239).
import type { SessionArchiveStore } from './archive-store'
import { growWindow } from './archive-window'
import { sessionArchiveSetRequestSchema, sessionError } from './contract'
import { versionFailure } from './read-request'
import type { SessionSource } from './session-source'

// Every id each named Session has answered to. A Session outside the loaded window resolves to
// itself alone, which is still the right key to remove: it is the one the caller archived under.
async function everyIdAnsweredTo(
  sources: SessionSource[],
  sessionIds: readonly string[],
): Promise<string[]> {
  const found = (rows: { id: string }[]) =>
    sessionIds.every((id) => rows.some((row) => row.id === id))
  const { rows } = await growWindow(sources, {}, found)
  return sessionIds.flatMap((id) => {
    const row = rows.find((candidate) => candidate.id === id)
    return row === undefined ? [id] : [row.id, ...row.retiredIds]
  })
}

export async function archiveSetReply(
  sources: SessionSource[],
  value: unknown,
  archive: SessionArchiveStore,
) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionArchiveSetRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const { sessionIds, archived, requestId } = parsed.data
  // Archiving writes the id the caller holds, so it needs no lookup at all. Restoring does.
  const wrote = await archive.setArchived(
    archived ? sessionIds : await everyIdAnsweredTo(sources, sessionIds),
    archived,
  )
  return {
    version: 1 as const,
    type: 'session.archive.applied' as const,
    requestId,
    archived,
    applied: wrote ? [...sessionIds] : [],
    failed: wrote ? [] : [...sessionIds],
  }
}
