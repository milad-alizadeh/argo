// The two main-process actions behind the Session contract. Everything they touch is read-only:
// this slice observes transcripts and writes nothing back to them.
import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionFeedReply, SessionListReply } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import {
  createTranscriptSessionReader,
  mergeManagedRoster,
} from '@/core/sessions/read-transcript-sessions'
import { discoverSessions, readSessionFiles } from './discover'
import { projectFeed } from './feed'

async function completeCompactions(
  transcripts: string,
  sessions: SessionRosterRow[],
  complete: ((sessionId: string, completedAt: string) => void) | undefined,
) {
  if (complete === undefined) return
  for (const session of sessions) {
    if (session.compactionStartedAt === null || session.compactionStartedAt === undefined) continue
    const chain = await readSessionFiles(transcripts, session.id)
    const completedAt = chain?.files
      .flatMap((file) => file.records)
      .filter((record) => record.kind === 'compaction')
      .flatMap((record) => (record.timestamp === undefined ? [] : [record.timestamp]))
      .sort()
      .at(-1)
    if (completedAt !== undefined) complete(session.id, completedAt)
  }
}

// Two roots, because the two readings live in two places: the transcripts the CLI writes, and the
// Claude desktop app's own store, which is where the archive flag already lives. `archive` is
// optional: a machine without that app installed reads no archived Sessions rather than failing.
export function createClaudeSessionReader(roots: {
  transcripts: string
  archive?: string
  managedSessions?: () => SessionRosterRow[]
  completeCompaction?: (sessionId: string, completedAt: string) => void
  orphans?: () => ReadonlySet<string>
}): SessionReader {
  return createTranscriptSessionReader({
    discoverSessions: async () => {
      const discovered = await discoverSessions(roots.transcripts, roots.archive)
      // ADR-0026: a Session an Argo held and no running window holds now reads orphaned.
      const orphans = roots.orphans?.() ?? new Set()
      const graded = discovered.rows.map(
        (row): SessionRosterRow => (orphans.has(row.id) ? { ...row, posture: 'orphaned' } : row),
      )
      const managed = roots.managedSessions?.() ?? []
      await completeCompactions(roots.transcripts, managed, roots.completeCompaction)
      return mergeManagedRoster({ ...discovered, rows: graded }, managed)
    },
    readSessionFiles: (sessionId) => readSessionFiles(roots.transcripts, sessionId),
    projectFeed,
  })
}

export function listSessions(
  value: unknown,
  root: string,
  archiveRoot?: string,
): Promise<SessionListReply> {
  return createClaudeSessionReader({ transcripts: root, archive: archiveRoot }).listSessions(
    value,
  ) as Promise<SessionListReply>
}

export function readFeed(value: unknown, root: string): Promise<SessionFeedReply> {
  return createClaudeSessionReader({ transcripts: root }).readSessionFeed(
    value,
  ) as Promise<SessionFeedReply>
}
