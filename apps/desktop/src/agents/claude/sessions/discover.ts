// Discovering Claude Sessions on this machine. No Project registration is required and none is
// consulted: the CLI writes its transcripts under one root, and the roster is rebuilt from them
// every launch (ADR-0004, ADR-0008).
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
} from '@/core/sessions/discover-transcript-sessions'
import { readArchivedSessions } from './archive'
import { parseTranscriptLine } from './records'

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

export const { readSessionFiles } = reader

// A Session the archive store names is joined by its stable id or by any id it retired: a resume
// can move a Session's id forward, and the store still names whichever id was current when the
// reader archived it.
export async function discoverSessions(root: string, archiveRoot?: string): Promise<Discovery> {
  const discovery = await reader.discoverSessions(root)
  if (archiveRoot === undefined) return discovery
  const archived = await readArchivedSessions(archiveRoot)
  return {
    ...discovery,
    rows: discovery.rows.map((row) => ({
      ...row,
      archived: archived.has(row.id) || row.retiredIds.some((id) => archived.has(id)),
    })),
  }
}
