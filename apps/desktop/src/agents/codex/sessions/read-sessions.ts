import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionFeedReply, SessionListReply } from '@/core/sessions/contract'
import { projectFeed } from '@/core/sessions/feed'
import { type FeedOverlay, withFeedOverlay } from '@/core/sessions/live-feed'
import type { SessionFeedRow, SessionRosterRow } from '@/core/sessions/models'
import { createTranscriptSessionReader } from '@/core/sessions/read-transcript-sessions'
import type { LiveMessage } from '../drive/codex-session-driver'
import { discoverSessions, readSessionFiles } from './discover'

// The managed Sessions the driver holds, and what their Turns have streamed so far.
type ReaderOptions = {
  roster?: () => SessionRosterRow[]
  liveMessages?: (sessionId: string) => LiveMessage[]
}

// A streamed message takes the row id the rollout's own message will get (`feed.ts`), so the
// finished row replaces the draft in place rather than drawing beside it.
function draftRows(rows: readonly SessionFeedRow[], live: LiveMessage[]): SessionFeedRow[] {
  return live
    .filter((message) => !rows.some((row) => row.id.startsWith(`${message.id}:`)))
    .map((message) => ({
      shape: 'prose',
      id: `${message.id}:0`,
      role: 'assistant',
      text: message.text,
    }))
}

function draftOverlay(live: LiveMessage[]): FeedOverlay | null {
  if (live.length === 0) return null
  return (rows) => {
    const drafts = draftRows(rows, live)
    return { rows: [...rows, ...drafts], changes: drafts }
  }
}

export function createCodexSessionReader(root: string, options?: ReaderOptions): SessionReader {
  const reader = createTranscriptSessionReader({
    discoverSessions: () => discoverSessions(root),
    readSessionFiles: (sessionId) => readSessionFiles(root, sessionId),
    projectFeed,
    managedSessions: options?.roster,
  })
  const liveMessages = options?.liveMessages
  if (liveMessages === undefined) return reader
  return withFeedOverlay(reader, (sessionId) => draftOverlay(liveMessages(sessionId)))
}

export function listSessions(value: unknown, root: string): Promise<SessionListReply> {
  return createCodexSessionReader(root).listSessions(value) as Promise<SessionListReply>
}

export function readFeed(value: unknown, root: string): Promise<SessionFeedReply> {
  return createCodexSessionReader(root).readSessionFeed(value) as Promise<SessionFeedReply>
}
