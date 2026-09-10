// The two main-process actions behind the Session contract. Everything they touch is read-only:
// this slice observes transcripts and writes nothing back to them.
import type { SessionReader } from '../../../core/sessions/bridge'
import type { SessionFeedReply, SessionListReply } from '../../../core/sessions/contract'
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

export function listSessions(value: unknown, root: string): Promise<SessionListReply> {
  return createClaudeSessionReader(root).listSessions(value) as Promise<SessionListReply>
}

export function readFeed(value: unknown, root: string): Promise<SessionFeedReply> {
  return createClaudeSessionReader(root).readSessionFeed(value) as Promise<SessionFeedReply>
}
