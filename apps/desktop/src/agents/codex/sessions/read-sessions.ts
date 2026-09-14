import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionRenameReply, SessionRenameRequest } from '@/core/sessions/contract'
import { projectFeed } from '@/core/sessions/feed'
import { mergeManagedRoster } from '@/core/sessions/managed-row'
import type { SessionFeedRow, SessionRosterRow } from '@/core/sessions/models'
import { createSessionReader, type FeedOverlay, type SessionSource } from '@/core/sessions/reader'
import type { LiveMessage } from '../drive/codex-session-driver'
import { discoverSessions, readSessionFiles } from './discover'

// The managed Sessions the driver holds, and what their Turns have streamed so far.
type ReaderOptions = {
  roster?: () => SessionRosterRow[]
  liveMessages?: (sessionId: string) => LiveMessage[]
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
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

export function codexSessionSource(root: string, options?: ReaderOptions): SessionSource {
  const liveMessages = options?.liveMessages
  return {
    cli: 'codex',
    discoverSessions: async () =>
      mergeManagedRoster(
        await discoverSessions(root),
        options?.roster?.() ?? [],
        (observed, managed) => ({
          ...observed,
          posture: managed.posture,
          status: managed.status,
        }),
      ),
    readSessionFiles: (sessionId) => readSessionFiles(root, sessionId),
    projectFeed,
    managedSessions: options?.roster,
    rename: options?.rename,
    overlayFor:
      liveMessages === undefined ? undefined : (sessionId) => draftOverlay(liveMessages(sessionId)),
  }
}

export function createCodexSessionReader(root: string, options?: ReaderOptions): SessionReader {
  return createSessionReader([codexSessionSource(root, options)])
}
