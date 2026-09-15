import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionRenameReply, SessionRenameRequest } from '@/core/sessions/contract'
import { projectFeed } from '@/core/sessions/feed'
import { mergeManagedRoster } from '@/core/sessions/managed-row'
import type { SessionFeedRow, SessionRosterRow } from '@/core/sessions/models'
import { createSessionReader, type FeedOverlay, type SessionSource } from '@/core/sessions/reader'
import { markCompactingRows } from '../../compaction/compaction-roster'
import type { LiveMessage } from '../drive/codex-session-driver'
import type { PendingCodexQuestion } from '../drive/question-protocol'
import { clearFullRecords, discoverSessions, readSessionFiles } from './discover'
import { draftText } from './harness-envelopes'

// The managed Sessions the driver holds, and what their Turns have streamed so far.
type ReaderOptions = {
  roster?: () => SessionRosterRow[]
  liveMessages?: (sessionId: string) => LiveMessage[]
  // Codex has no persisted transcript record of a still-open question (unlike Claude's
  // `AskUserQuestion` tool call, #1841): the Feed's `ask` row exists only while this returns one.
  pendingQuestion?: (sessionId: string) => PendingCodexQuestion | null
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
  isLockedElsewhere?: (sessionId: string) => boolean
  // Where the `PreCompact` hook leaves a file for each compaction it sees start (ADR-0041).
  compactionStarts?: string
}

// A streamed message takes the row id the rollout's own message will get (`feed.ts`), so the
// finished row replaces the draft in place rather than drawing beside it.
function draftRows(rows: readonly SessionFeedRow[], live: LiveMessage[]): SessionFeedRow[] {
  return live
    .filter((message) => !rows.some((row) => row.id.startsWith(`${message.id}:`)))
    .map((message) => ({ id: message.id, text: draftText(message.text) }))
    .filter((message) => message.text.length > 0)
    .map((message) => ({
      shape: 'prose',
      id: `${message.id}:0`,
      role: 'assistant',
      text: message.text,
    }))
}

// A pending question has no persisted transcript row to replace, so it always draws as one more
// row rather than matching an existing one the way a streamed draft message does. The row's id is
// the request's own item ID, unprefixed: a decision names it back to `decideQuestion`, which
// checks it against the same pending question's `itemId` (question-protocol.ts).
function questionRow(pending: PendingCodexQuestion): SessionFeedRow {
  return {
    shape: 'ask',
    id: pending.itemId,
    questions: pending.questions,
    answer: null,
    unsupported: pending.unsupported,
  }
}

function combinedOverlay(
  live: LiveMessage[],
  pending: PendingCodexQuestion | null,
): FeedOverlay | null {
  if (live.length === 0 && pending === null) return null
  return (rows) => {
    const drafts = draftRows(rows, live)
    const asks = pending === null ? [] : [questionRow(pending)]
    return { rows: [...rows, ...drafts, ...asks], changes: [...drafts, ...asks] }
  }
}

export function codexSessionSource(root: string, options?: ReaderOptions): SessionSource {
  const liveMessages = options?.liveMessages
  const pendingQuestion = options?.pendingQuestion
  const overlayFor =
    liveMessages === undefined && pendingQuestion === undefined
      ? undefined
      : (sessionId: string) =>
          combinedOverlay(liveMessages?.(sessionId) ?? [], pendingQuestion?.(sessionId) ?? null)
  return {
    cli: 'codex',
    discoverSessions: async () => {
      const discovered = await discoverSessions(root)
      const roster = mergeManagedRoster(discovered, options?.roster?.() ?? [])
      const rows = await markCompactingRows(roster.rows, {
        folder: options?.compactionStarts,
        readChain: (sessionId) => readSessionFiles(root, sessionId),
      })
      return { ...roster, rows }
    },
    readSessionFiles: (sessionId) => readSessionFiles(root, sessionId),
    disposeFullRecords: (sessionId) => clearFullRecords(sessionId),
    projectFeed,
    managedSessions: options?.roster,
    isLockedElsewhere: options?.isLockedElsewhere,
    rename: options?.rename,
    overlayFor,
  }
}

export function createCodexSessionReader(root: string, options?: ReaderOptions): SessionReader {
  return createSessionReader([codexSessionSource(root, options)])
}
