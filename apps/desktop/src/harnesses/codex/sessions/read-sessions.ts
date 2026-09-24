import type {
  SessionRenameReply,
  SessionRenameRequest,
} from '@/domains/sessions/contract/ipc/contract'
import { askRow } from '@/domains/sessions/contract/model/feed/tool-feed'
import type { SessionFeedRow, SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionIndex } from '@/domains/sessions/main/indexing/session-index/contract'
import { discoverRoster } from '@/domains/sessions/main/observation/reader/discover-roster'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/reader'
import type { FeedOverlay } from '@/domains/sessions/main/observation/reader/session-source'
import type { PendingCodexQuestion } from '../drive/protocol/question-protocol'
import type { LiveMessage } from '../drive/session/codex-session-driver'
import {
  backfillTick,
  clearFullRecords,
  discoverSessions,
  historyComplete,
  nameThreads,
  readSessionFiles,
  readSubagentFiles as readSubagentFilesForParent,
  reconcileAll,
  resolveIds,
  searchIndexed,
} from './discovery/discover'
import { readSubagentTokens } from './facts/subagent-tokens'
import { readSubagentChain } from './facts/subagents'
import { draftText } from './records/harness-envelopes'
import {
  createHeldRolloutReader,
  joinHeldRollouts,
  type OpenFileListing,
} from './records/held-rollouts'
import { createOpenTurnReader, joinOpenTurns } from './thread/open-turns'
import type { ThreadNames } from './thread/thread-names'

// The managed Sessions the driver holds, and what their Turns have streamed so far.
export type ReaderOptions = {
  roster?: () => SessionRosterRow[]
  liveMessages?: (sessionId: string) => LiveMessage[]
  // Codex has no persisted transcript record of a still-open question (unlike Claude's
  // ask tool call, #1841): the Feed's `ask` row exists only while this returns one.
  pendingQuestion?: (sessionId: string) => PendingCodexQuestion | null
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
  isLockedElsewhere?: (sessionId: string) => boolean
  // The files every Codex process holds open, in `lsof -F n` form; a test hands in a listing.
  listOpenFiles?: OpenFileListing
  // Codex Desktop's own thread names, read from its app state (ADR-0042).
  threadNames?: ThreadNames
  // The app's Session index, when one is open. Absent, discovery parses the window itself (#2372).
  index?: SessionIndex
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
  return askRow(pending.itemId, pending, null)
}

function combinedOverlay(
  live: LiveMessage[],
  pending: PendingCodexQuestion | null,
): FeedOverlay | null {
  if (live.length === 0 && pending === null) return null
  return (rows) => {
    const drafts = draftRows(rows, live)
    const asks = pending === null ? [] : [questionRow(pending)]
    return {
      rows: [...rows, ...drafts, ...asks],
      changes: { rows: [...drafts, ...asks], aliases: [] },
    }
  }
}

// Archive and restore (#2374) resolve an id straight off the index's persisted resume graph, and
// background backfill and reconciliation (#2373) tick it forward. All four are absent together
// with no index open, so a caller with no `resolveIndexedIds` never has one of the others either.
function indexCapabilities(root: string, index: SessionIndex | undefined) {
  if (index === undefined) return {}
  return {
    backfillTick: (batchSize?: number) => backfillTick(root, index, batchSize),
    reconcileAll: () => reconcileAll(root, index),
    resolveIndexedIds: (ids: readonly string[]) => resolveIds(index, ids),
    historyComplete: () => historyComplete(index),
    searchSessions: (query: string) => searchIndexed(index, query),
  }
}

// A thread another Codex process is running (open Turn) or holding (open rollout) is locked
// (ADR-0040); both readings join after the managed roster so Argo's own threads stay resumable.
function rosterDiscovery(root: string, options?: ReaderOptions): SessionSource['discoverSessions'] {
  const openTurns = createOpenTurnReader(root)
  const heldRollouts = createHeldRolloutReader(options?.listOpenFiles)
  return async (discoverOptions) => {
    const now = Date.now()
    const [discovery, open, held] = await Promise.all([
      discoverSessions(root, { ...discoverOptions, index: options?.index }),
      openTurns(now),
      heldRollouts(now),
    ])
    const threadNames = options?.threadNames
    return discoverRoster({
      discovery,
      managed: options?.roster?.() ?? [],
      joins: {
        observed: threadNames === undefined ? [] : [(rows) => nameThreads(rows, threadNames)],
        merged: [(rows) => joinOpenTurns(rows, open, now), (rows) => joinHeldRollouts(rows, held)],
      },
      projectRoot: discoverOptions?.projectRoot,
    })
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
    harness: 'codex',
    ...indexCapabilities(root, options?.index),
    discoverSessions: rosterDiscovery(root, options),
    readSessionFiles: (sessionId) => readSessionFiles(root, sessionId, options?.index),
    readSubagentFiles: async (sessionId, subagentId) =>
      (await readSubagentFilesForParent(root, sessionId, subagentId)) ??
      readSubagentChain(root, subagentId),
    readSubagentUsage: async (sessionId) => {
      const chain = await readSessionFiles(root, sessionId, options?.index)
      const subagentIds = [
        ...new Set(
          chain?.files
            .flatMap((file) => file.records)
            .flatMap((record) => (record.kind === 'subagent' ? [record.subagentId] : [])) ?? [],
        ),
      ]
      return readSubagentTokens(root, subagentIds)
    },
    disposeFullRecords: (sessionId) => clearFullRecords(sessionId),
    readShellOutput: async () => ({ state: 'absent' }),
    managedSessions: options?.roster,
    isLockedElsewhere: options?.isLockedElsewhere,
    rename: options?.rename,
    overlayFor,
  }
}
