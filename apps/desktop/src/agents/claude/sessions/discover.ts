// Discovering Claude Sessions on this machine. No Project registration is required and none is
// consulted: the CLI writes its transcripts under one root, and the roster is rebuilt from them
// every launch (ADR-0004, ADR-0008).
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
} from '@/core/sessions/discover-transcript-sessions'
import type { ArchivedSessionsPage } from '@/core/sessions/session-source'
import { readArchivedSessions, writeArchivedSessionFlags } from './archive'
import { parseTranscriptLine } from './records'

// A page's worth of Archived Sessions (#1593), read on demand rather than on every poll.
const ARCHIVE_PAGE_LIMIT = 20

// How many transcript files one Roster pass reads, most recently written first. Measured on a
// real tree of 1,055 files holding 3.3 GB: streaming 200 of them costs about 1.6 s and 60 about
// 0.5 s. The count is stated on the reply rather than hidden, so a Roster that did not reach
// every file says so instead of reading as the whole machine.
export type Discovery = TranscriptDiscovery

async function transcriptPaths(root: string): Promise<{ path: string; name: string }[]> {
  const directories = await readdir(root, { withFileTypes: true })
  const found: { path: string; name: string }[] = []
  for (const directory of directories) {
    if (!directory.isDirectory()) continue
    const inside = await readdir(path.join(root, directory.name)).catch(() => [])
    for (const name of inside) {
      if (name.endsWith('.jsonl')) found.push({ path: path.join(root, directory.name, name), name })
    }
  }
  return found
}

const reader = createTranscriptDiscoverer({
  cli: 'claude',
  transcriptPaths,
  parse: parseTranscriptLine,
})

export const { clearFullRecords, readSessionFiles } = reader

function isArchived(
  row: { id: string; retiredIds: string[] },
  archived: ReadonlySet<string>,
): boolean {
  return archived.has(row.id) || row.retiredIds.some((id) => archived.has(id))
}

// A Session the archive store names is joined by its stable id or by any id it retired: a resume
// can move a Session's id forward, and the store still names whichever id was current when the
// reader archived it. The active Roster never carries an archived row (#1593): expanding Archive
// asks discoverArchivedSessions below instead, on demand.
export async function discoverSessions(root: string, archiveRoot?: string): Promise<Discovery> {
  const discovery = await reader.discoverSessions(root)
  if (archiveRoot === undefined) return discovery
  const archived = await readArchivedSessions(archiveRoot)
  return {
    ...discovery,
    rows: discovery.rows
      .map((row) => ({ ...row, archived: isArchived(row, archived) }))
      .filter((row) => !row.archived),
  }
}

// One page of the reader's Archived Sessions, offset-paginated over the same parsed, cached rows
// discoverSessions above reads: detecting an archived row requires the full chain-stitched parse
// (a Session can be archived under a retired id), so a page costs the same read as the active
// list and only withholds its rows from that reply.
export async function discoverArchivedSessions(
  root: string,
  archiveRoot: string,
  options: { cursor: string | null; restoreId: string | null },
): Promise<ArchivedSessionsPage> {
  const discovery = await reader.discoverSessions(root)
  const archivedIds = await readArchivedSessions(archiveRoot)
  const archived = discovery.rows
    .filter((row) => isArchived(row, archivedIds))
    .map((row) => ({ ...row, archived: true }))
  const offset = options.cursor === null ? 0 : Number.parseInt(options.cursor, 10)
  const page = archived.slice(offset, offset + ARCHIVE_PAGE_LIMIT)
  const nextCursor =
    offset + ARCHIVE_PAGE_LIMIT >= archived.length ? null : String(offset + ARCHIVE_PAGE_LIMIT)
  const restoreId = options.restoreId
  const restored =
    restoreId === null
      ? null
      : (archived.find((row) => row.id === restoreId || row.retiredIds.includes(restoreId)) ?? null)
  return { rows: page, nextCursor, restored }
}

// Setting the archive flag for a batch of Sessions (#2194), by canonical id: each id is resolved
// against the full discovery (active and archived alike) so a Session archived under a retired id
// is still found under its current one, and the write reaches whichever file the store already
// keeps for it under any id it has answered to.
export async function setArchivedSessions(
  root: string,
  archiveRoot: string,
  request: { ids: readonly string[]; archived: boolean },
): Promise<{ applied: string[]; failed: string[] }> {
  const discovery = await reader.discoverSessions(root)
  const targets = request.ids.map((id) => {
    const row = discovery.rows.find((candidate) => candidate.id === id)
    return { id, candidateIds: row === undefined ? [id] : [row.id, ...row.retiredIds] }
  })
  return await writeArchivedSessionFlags(archiveRoot, targets, request.archived)
}
