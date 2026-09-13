import { createHash } from 'node:crypto'
import { isRecord } from '@/boundary'
import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionFeedRead, SessionFeedReply, SessionListReply } from '@/core/sessions/contract'
import { projectFeed } from '@/core/sessions/feed'
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

function withDrafts(read: SessionFeedRead, drafts: SessionFeedRow[]): SessionFeedRead {
  if (drafts.length === 0) return read
  const revision = createHash('sha256')
    .update(JSON.stringify({ revision: read.revision, drafts }))
    .digest('hex')
  return { ...read, revision, rows: [...read.rows, ...drafts] }
}

// Drafts change with no file changing, so while a Turn streams the rollout's document is read
// whole and the revision covers both; a renderer that holds that revision is told so.
async function readLiveFeed(
  reader: SessionReader,
  value: unknown,
  liveMessages: (sessionId: string) => LiveMessage[],
): Promise<unknown> {
  const sessionId = isRecord(value) && typeof value.sessionId === 'string' ? value.sessionId : null
  const live = sessionId === null ? [] : liveMessages(sessionId)
  if (live.length === 0 || !isRecord(value)) return reader.readSessionFeed(value)
  const reply = (await reader.readSessionFeed({ ...value, revision: null })) as SessionFeedReply
  if (reply.type !== 'session.feed.read') return reply
  const read = withDrafts(reply, draftRows(reply.rows, live))
  if (read.revision !== value.revision) return read
  const { rows: _rows, ...unchanged } = read
  return { ...unchanged, type: 'session.feed.unchanged' }
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
  return {
    listSessions: reader.listSessions,
    readSessionFeed: (value) => readLiveFeed(reader, value, liveMessages),
  }
}

export function listSessions(value: unknown, root: string): Promise<SessionListReply> {
  return createCodexSessionReader(root).listSessions(value) as Promise<SessionListReply>
}

export function readFeed(value: unknown, root: string): Promise<SessionFeedReply> {
  return createCodexSessionReader(root).readSessionFeed(value) as Promise<SessionFeedReply>
}
