// The two main-process actions behind the Session contract. Everything they touch is read-only:
// this slice observes transcripts and writes nothing back to them.
import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionFeedReply, SessionListReply } from '@/core/sessions/contract'
import { createTranscriptSessionReader } from '@/core/sessions/read-transcript-sessions'
import { discoverSessions, readSessionFiles } from './discover'
import { projectFeed } from './feed'

// Two roots, because the two readings live in two places: the transcripts the CLI writes, and the
// Claude desktop app's own store, which is where the archive flag already lives. `archive` is
// optional: a machine without that app installed reads no archived Sessions rather than failing.
export function createClaudeSessionReader(roots: {
  transcripts: string
  archive?: string
}): SessionReader {
  return createTranscriptSessionReader({
    discoverSessions: () => discoverSessions(roots.transcripts, roots.archive),
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
