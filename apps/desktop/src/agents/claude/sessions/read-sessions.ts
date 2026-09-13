// The Claude source the shared Session reader drives (#2025). Everything this slice touches is
// read-only: it observes transcripts and writes nothing back to them.
import type { SessionReader } from '@/core/sessions/bridge'
import { mergeManagedRoster } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import { createSessionReader, type SessionSource } from '@/core/sessions/reader'
import type { LiveMessage } from '../drive/live-messages'
import { discoverSessions, readSessionFiles } from './discover'
import { projectFeed } from './feed'
import { draftOverlay } from './live-feed'

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
export function claudeSessionSource(roots: {
  transcripts: string
  archive?: string
  managedSessions?: () => SessionRosterRow[]
  completeCompaction?: (sessionId: string, completedAt: string) => void
  orphans?: () => ReadonlySet<string>
  liveMessages?: (sessionId: string) => LiveMessage[]
}): SessionSource {
  const aliases = new Map<string, Map<string, string>>()
  const liveMessages = roots.liveMessages
  return {
    cli: 'claude',
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
    managedSessions: roots.managedSessions,
    overlayFor:
      liveMessages === undefined
        ? undefined
        : (sessionId) => {
            const held = aliases.get(sessionId) ?? new Map<string, string>()
            aliases.set(sessionId, held)
            return draftOverlay(liveMessages(sessionId), held)
          },
  }
}

export function createClaudeSessionReader(roots: {
  transcripts: string
  archive?: string
  managedSessions?: () => SessionRosterRow[]
  orphans?: () => ReadonlySet<string>
  liveMessages?: (sessionId: string) => LiveMessage[]
}): SessionReader {
  return createSessionReader([claudeSessionSource(roots)])
}
