// The two main-process actions behind the Session contract. Everything they touch is read-only:
// this slice observes transcripts and writes nothing back to them.
import type { SessionReader } from '../../../core/sessions/bridge'
import { createTranscriptSessionReader } from '../../../core/sessions/read-transcript-sessions'
import { discoverSessions, readSessionFiles } from './discover'
import { projectFeed } from './feed'

export function createClaudeSessionReader(root: string): SessionReader {
  return createTranscriptSessionReader({
    discoverSessions: () => discoverSessions(root),
    readSessionFiles: (sessionId) => readSessionFiles(root, sessionId),
    projectFeed,
  })
}
