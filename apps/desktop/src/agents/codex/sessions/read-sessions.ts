import type { SessionRenameReply, SessionRenameRequest } from '@/core/sessions/contract'
import { discoverRoster } from '@/core/sessions/discover-roster'
import type { SessionFeedRow, SessionRosterRow } from '@/core/sessions/models'
import type { FeedOverlay, SessionSource } from '@/core/sessions/reader'
import type { LiveMessage } from '../drive/codex-session-driver'
import type { PendingCodexQuestion } from '../drive/question-protocol'
import { clearFullRecords, discoverSessions, nameThreads, readSessionFiles } from './discover'
import { draftText } from './harness-envelopes'
import { createOpenTurnReader, joinOpenTurns } from './open-turns'
import type { ThreadNames } from './thread-names'

// The managed Sessions the driver holds, and what their Turns have streamed so far.
type ReaderOptions = {
  roster?: () => SessionRosterRow[]
  liveMessages?: (sessionId: string) => LiveMessage[]
  // Codex has no persisted transcript record of a still-open question (unlike Claude's
  // `AskUserQuestion` tool call, #1841): the Feed's `ask` row exists only while this returns one.
  pendingQuestion?: (sessionId: string) => PendingCodexQuestion | null
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
  isLockedElsewhere?: (sessionId: string) => boolean
  // Codex Desktop's own thread names, read from its app state (ADR-0042).
  threadNames?: ThreadNames
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
  const openTurns = createOpenTurnReader(root)
  return {
    cli: 'codex',
    discoverSessions: async (discoverOptions) => {
      const [discovery, open] = await Promise.all([
        discoverSessions(root, discoverOptions),
        openTurns(Date.now()),
      ])
      const threadNames = options?.threadNames
      return discoverRoster({
        discovery,
        managed: options?.roster?.() ?? [],
        joins: {
          observed: threadNames === undefined ? [] : [(rows) => nameThreads(rows, threadNames)],
          merged: [(rows) => joinOpenTurns(rows, open)],
        },
        projectRoot: discoverOptions?.projectRoot,
      })
    },
    readSessionFiles: (sessionId) => readSessionFiles(root, sessionId),
    disposeFullRecords: (sessionId) => clearFullRecords(sessionId),
    managedSessions: options?.roster,
    isLockedElsewhere: options?.isLockedElsewhere,
    rename: options?.rename,
    overlayFor,
  }
}
