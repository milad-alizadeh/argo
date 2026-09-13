// The two main-process actions behind the Session contract. Everything they touch is read-only:
// this slice observes transcripts and writes nothing back to them.
import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionFeedReply, SessionListReply } from '@/core/sessions/contract'
import type { SessionRosterRow } from '@/core/sessions/models'
import { createTranscriptSessionReader } from '@/core/sessions/read-transcript-sessions'
import { discoverSessions, readSessionFiles } from './discover'
import { projectFeed } from './feed'

// Two roots, because the two readings live in two places: the transcripts the CLI writes, and the
// Claude desktop app's own store, which is where the archive flag already lives. `archive` is
// optional: a machine without that app installed reads no archived Sessions rather than failing.
export function createClaudeSessionReader(roots: {
  transcripts: string
  archive?: string
  managedSessions?: () => SessionRosterRow[]
}): SessionReader {
  return createTranscriptSessionReader({
    discoverSessions: async () => {
      const discovered = await discoverSessions(roots.transcripts, roots.archive)
      const managed = roots.managedSessions?.() ?? []
      const managedById = new Map(managed.map((session) => [session.id, session]))
      const observed = discovered.rows.map((session) => {
        const held = managedById.get(session.id)
        return held === undefined ? session : { ...session, posture: held.posture }
      })
      const unobserved = managed.filter(
        (session) => !discovered.rows.some(({ id }) => id === session.id),
      )
      return { ...discovered, rows: [...observed, ...unobserved] }
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
