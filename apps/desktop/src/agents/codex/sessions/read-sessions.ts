import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionFeedReply, SessionListReply } from '@/core/sessions/contract'
import { projectFeed } from '@/core/sessions/feed'
import { createTranscriptSessionReader } from '@/core/sessions/read-transcript-sessions'
import { discoverSessions, readSessionFiles } from './discover'

export function createCodexSessionReader(root: string): SessionReader {
  return createTranscriptSessionReader({
    discoverSessions: () => discoverSessions(root),
    readSessionFiles: (sessionId) => readSessionFiles(root, sessionId),
    projectFeed,
  })
}

export function listSessions(value: unknown, root: string): Promise<SessionListReply> {
  return createCodexSessionReader(root).listSessions(value) as Promise<SessionListReply>
}

export function readFeed(value: unknown, root: string): Promise<SessionFeedReply> {
  return createCodexSessionReader(root).readSessionFeed(value) as Promise<SessionFeedReply>
}
