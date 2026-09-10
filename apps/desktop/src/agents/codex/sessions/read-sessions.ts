import type { SessionReader } from '../../../core/sessions/bridge'
import { projectFeed } from '../../../core/sessions/feed'
import { createTranscriptSessionReader } from '../../../core/sessions/read-transcript-sessions'
import { discoverSessions, readSessionFiles } from './discover'

export function createCodexSessionReader(root: string): SessionReader {
  return createTranscriptSessionReader({
    discoverSessions: () => discoverSessions(root),
    readSessionFiles: (sessionId) => readSessionFiles(root, sessionId),
    projectFeed,
  })
}
