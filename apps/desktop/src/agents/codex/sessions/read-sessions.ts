import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionFeedReply, SessionListReply } from '@/core/sessions/contract'
import { projectFeed } from '@/core/sessions/feed'
import type { SessionRosterRow } from '@/core/sessions/models'
import {
  createTranscriptSessionReader,
  mergeManagedRoster,
} from '@/core/sessions/read-transcript-sessions'
import { discoverSessions, readSessionFiles } from './discover'

export function createCodexSessionReader(
  root: string,
  options?: { managedSessions?: () => SessionRosterRow[] },
): SessionReader {
  return createTranscriptSessionReader({
    discoverSessions: async () => {
      const discovered = await discoverSessions(root)
      return mergeManagedRoster(discovered, options?.managedSessions?.() ?? [])
    },
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
