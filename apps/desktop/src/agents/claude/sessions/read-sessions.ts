// The two main-process actions behind the Session contract. Everything they touch is read-only:
// this slice observes transcripts and writes nothing back to them.
import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionFeedReply, SessionListReply } from '@/core/sessions/contract'
import { withFeedOverlay } from '@/core/sessions/live-feed'
import type { SessionRosterRow } from '@/core/sessions/models'
import {
  createTranscriptSessionReader,
  mergeManagedRoster,
} from '@/core/sessions/read-transcript-sessions'
import type { LiveMessage } from '../drive/live-messages'
import { discoverSessions, readSessionFiles } from './discover'
import { projectFeed } from './feed'
import { draftOverlay } from './live-feed'

// Two roots, because the two readings live in two places: the transcripts the CLI writes, and the
// Claude desktop app's own store, which is where the archive flag already lives. `archive` is
// optional: a machine without that app installed reads no archived Sessions rather than failing.
export function createClaudeSessionReader(roots: {
  transcripts: string
  archive?: string
  managedSessions?: () => SessionRosterRow[]
  orphans?: () => ReadonlySet<string>
  liveMessages?: (sessionId: string) => LiveMessage[]
}): SessionReader {
  const reader = createTranscriptSessionReader({
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
  })
  const liveMessages = roots.liveMessages
  if (liveMessages === undefined) return reader
  const aliases = new Map<string, Map<string, string>>()
  return withFeedOverlay(reader, (sessionId) => {
    const held = aliases.get(sessionId) ?? new Map<string, string>()
    aliases.set(sessionId, held)
    return draftOverlay(liveMessages(sessionId), held)
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
