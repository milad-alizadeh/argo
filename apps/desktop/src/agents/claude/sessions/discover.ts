// Discovering Claude Sessions on this machine. No Project registration is required and none is
// consulted: the CLI writes its transcripts under one root, and the roster is rebuilt from them
// every launch (ADR-0004, ADR-0008).
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  createTranscriptDiscoverer,
  ROSTER_PAGE_SIZE,
  type TranscriptDiscovery,
} from '@/core/sessions/discover-transcript-sessions'
import type { ArchivedSessionsPage } from '@/core/sessions/session-source'
import { readArchivedSessions, writeArchivedSessionFlags } from './archive'
import { parseTranscriptLine } from './records'

// A page's worth of Archived Sessions (#1593), read on demand rather than on every poll.
const ARCHIVE_PAGE_LIMIT = 20

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
export async function discoverSessions(
  root: string,
  archiveRoot?: string,
  options?: { cursor?: string | null },
): Promise<Discovery> {
  const discovery = await reader.discoverSessions(root, options)
  if (archiveRoot === undefined) return discovery
  const archived = await readArchivedSessions(archiveRoot)
  return {
    ...discovery,
    rows: discovery.rows
      .map((row) => ({ ...row, archived: isArchived(row, archived) }))
      .filter((row) => !row.archived),
  }
}

// Archive's cursor names both dimensions it pages over: `read`, how many of the most recent files
// the underlying pass has read so far, and `offset`, how many archived rows earlier pages already
// returned. Encoded together so a caller only ever echoes what a reply gave it.
function decodeArchiveCursor(cursor: string | null): { read: number; offset: number } {
  const parts = (cursor ?? '').split(':')
  const read = Number.parseInt(parts[0] ?? '', 10)
  const offset = Number.parseInt(parts[1] ?? '', 10)
  return {
    read: Number.isFinite(read) && read > 0 ? read : ROSTER_PAGE_SIZE,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
  }
}

// One page of the reader's Archived Sessions (#1593, #2239): detecting an archived row requires
// the full chain-stitched parse (a Session can be archived under a retired id), so this grows the
// same bounded window discoverSessions pages by, reading only as many more files as it takes to
// fill this page, rather than the whole tree on every page as before.
export async function discoverArchivedSessions(
  root: string,
  archiveRoot: string,
  options: { cursor: string | null; restoreId: string | null },
): Promise<ArchivedSessionsPage> {
  const archivedIds = await readArchivedSessions(archiveRoot)
  const restoreId = options.restoreId
  let { read, offset } = decodeArchiveCursor(options.cursor)
  let discovery = await reader.discoverSessions(root, { cursor: String(read) })
  let archived = discovery.rows
    .filter((row) => isArchived(row, archivedIds))
    .map((row) => ({ ...row, archived: true }))
  const restoredIn = (rows: typeof archived) =>
    restoreId === null
      ? null
      : (rows.find((row) => row.id === restoreId || row.retiredIds.includes(restoreId)) ?? null)
  // Keep growing the window until this page is full, or a still-unfound `restoreId` is either
  // found or provably absent (every file has been read) — the two reasons this pass needs more
  // than the page it started with.
  while (
    discovery.nextCursor !== null &&
    (archived.length < offset + ARCHIVE_PAGE_LIMIT || restoredIn(archived) === null)
  ) {
    read += ROSTER_PAGE_SIZE
    discovery = await reader.discoverSessions(root, { cursor: String(read) })
    archived = discovery.rows
      .filter((row) => isArchived(row, archivedIds))
      .map((row) => ({ ...row, archived: true }))
  }
  const page = archived.slice(offset, offset + ARCHIVE_PAGE_LIMIT)
  const more = discovery.nextCursor !== null || archived.length > offset + ARCHIVE_PAGE_LIMIT
  const nextCursor = more ? `${read}:${offset + ARCHIVE_PAGE_LIMIT}` : null
  return { rows: page, nextCursor, restored: restoredIn(archived) }
}

// Setting the archive flag for a batch of Sessions (#2194), by canonical id: each id is resolved
// against a window grown just far enough to find every one of them (active and archived alike,
// #2239), so a Session archived under a retired id is still found under its current one even when
// it sits outside the roster's own bounded window, and the write reaches whichever file the store
// already keeps for it under any id it has answered to.
export async function setArchivedSessions(
  root: string,
  archiveRoot: string,
  request: { ids: readonly string[]; archived: boolean },
): Promise<{ applied: string[]; failed: string[] }> {
  let read = ROSTER_PAGE_SIZE
  let discovery = await reader.discoverSessions(root, { cursor: String(read) })
  const unresolved = () =>
    request.ids.some((id) => !discovery.rows.some((candidate) => candidate.id === id))
  while (unresolved() && discovery.nextCursor !== null) {
    read += ROSTER_PAGE_SIZE
    discovery = await reader.discoverSessions(root, { cursor: String(read) })
  }
  const targets = request.ids.map((id) => {
    const row = discovery.rows.find((candidate) => candidate.id === id)
    return { id, candidateIds: row === undefined ? [id] : [row.id, ...row.retiredIds] }
  })
  return await writeArchivedSessionFlags(archiveRoot, targets, request.archived)
}
