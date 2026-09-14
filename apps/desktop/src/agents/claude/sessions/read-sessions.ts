// The Claude source the shared Session reader drives (#2025). Everything this slice touches is
// read-only: it observes transcripts and writes nothing back to them.
import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionRenameReply, SessionRenameRequest } from '@/core/sessions/contract'
import { mergeManagedRoster } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import { createSessionReader, type SessionSource } from '@/core/sessions/reader'
import type { LiveMessage } from '../drive/live-messages'
import { discoverSessions, readSessionFiles } from './discover'
import { projectFeed } from './feed'
import { draftOverlay } from './live-feed'

// Two roots, because the two readings live in two places: the transcripts the CLI writes, and the
// Claude desktop app's own store, which is where the archive flag already lives. `archive` is
// optional: a machine without that app installed reads no archived Sessions rather than failing.
export function claudeSessionSource(roots: {
  transcripts: string
  archive?: string
  managedSessions?: () => SessionRosterRow[]
  orphans?: () => ReadonlySet<string>
  liveMessages?: (sessionId: string) => LiveMessage[]
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
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
      return mergeManagedRoster({ ...discovered, rows: graded }, roots.managedSessions?.() ?? [])
    },
    readSessionFiles: (sessionId) => readSessionFiles(roots.transcripts, sessionId),
    projectFeed,
    managedSessions: roots.managedSessions,
    rename: roots.rename,
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
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
}): SessionReader {
  return createSessionReader([claudeSessionSource(roots)])
}
