// The Claude source the shared Session reader drives (#2025). Transcripts are read-only, with no
// exception: archiving is Argo's own store, shared by every adapter
// (`domains/sessions/main/archive-store.ts`).

import type {
  SessionRenameReply,
  SessionRenameRequest,
} from '@/domains/sessions/contract/ipc/contract'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionIndex, SessionSource } from '@/domains/sessions/main'
import { discoverRoster } from '@/domains/sessions/main'
import {
  compactionEndedAt,
  markCompactingRows,
} from '@/harnesses/claude/compaction/compaction-roster'
import type { LiveMessage } from '@/harnesses/claude/drive/channel/live-messages'
import {
  backfillTick,
  clearFullRecords,
  discoverSessions,
  historyComplete,
  readSessionFiles,
  reconcileAll,
  resolveIds,
  searchIndexed,
} from './discover'
import { draftOverlay } from './live-feed'
import {
  joinLiveProcesses,
  lockLiveProcesses,
  type ProcessState,
  readLiveProcesses,
} from './live-processes'
import { readShellOutput } from '../records/shell-output'
import { readSubagentChain, readSubagentTokens } from '../subagents/subagents'

async function completeCompactions(options: {
  transcripts: string
  sessions: SessionRosterRow[]
  complete: ((sessionId: string, completedAt: string) => void) | undefined
  index: SessionIndex | undefined
}) {
  const { transcripts, sessions, complete, index } = options
  if (complete === undefined) return
  for (const session of sessions) {
    const startedAt = session.compactionStartedAt
    if (startedAt === null || startedAt === undefined) continue
    const chain = await readSessionFiles(transcripts, session.id, index)
    const endedAt = compactionEndedAt(chain, startedAt, Date.now())
    if (endedAt !== undefined) complete(session.id, endedAt)
  }
}

function withHandoffEdges(
  rows: SessionRosterRow[],
  handoffEdges: ((sessionId: string) => { to: string | null; from: string | null }) | undefined,
) {
  if (handoffEdges === undefined) return rows
  return rows.map((row) => {
    const edges = handoffEdges(row.id)
    return { ...row, handoffTo: edges.to, handoffFrom: edges.from }
  })
}

const NO_PROCESSES: ReadonlyMap<string, ProcessState> = new Map()

async function readLiveState(processes: string | undefined) {
  return processes === undefined ? NO_PROCESSES : await readLiveProcesses(processes)
}

export type ClaudeSessionRoots = {
  transcripts: string
  // Where each running `claude` names its Session; absent, no external Session reads `running` or locked.
  processes?: string
  managedSessions?: () => SessionRosterRow[]
  // Where the `PreCompact` hook leaves a file for each compaction it sees start (ADR-0041).
  compactionStarts?: string
  beginCompaction?: (sessionId: string, startedAt: string) => void
  completeCompaction?: (sessionId: string, completedAt: string) => void
  // Runs once per discovery pass, ahead of the read below: a handoff that has landed publishes
  // its fresh Session before this pass's roster is built, so the edge below finds it immediately.
  completeHandoffs?: () => void
  handoffEdges?: (sessionId: string) => { to: string | null; from: string | null }
  liveMessages?: (sessionId: string) => LiveMessage[]
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
  isLockedElsewhere?: (sessionId: string) => boolean
  // The app's Session index, when one is open. Absent, discovery parses the window itself (#2372).
  index?: SessionIndex
}

async function discoverClaudeSessions(
  roots: ClaudeSessionRoots,
  options: Parameters<SessionSource['discoverSessions']>[0],
) {
  const readChain = (sessionId: string) =>
    readSessionFiles(roots.transcripts, sessionId, roots.index)
  roots.completeHandoffs?.()
  const live = await readLiveState(roots.processes)
  const discovery = await discoverSessions(roots.transcripts, { ...options, index: roots.index })
  const managed = roots.managedSessions?.() ?? []
  await completeCompactions({
    transcripts: roots.transcripts,
    sessions: managed,
    complete: roots.completeCompaction,
    index: roots.index,
  })
  return discoverRoster({
    discovery,
    managed,
    joins: {
      observed: [(rows) => joinLiveProcesses(rows, live)],
      merged: [
        (rows) => lockLiveProcesses(rows, live),
        (rows) =>
          markCompactingRows(rows, {
            folder: roots.compactionStarts,
            readChain,
            begin: roots.beginCompaction,
          }),
        (rows) => withHandoffEdges(rows, roots.handoffEdges),
      ],
    },
    projectRoot: options?.projectRoot,
  })
}

export function claudeSessionSource(roots: ClaudeSessionRoots): SessionSource {
  const aliases = new Map<string, Map<string, string>>()
  const liveMessages = roots.liveMessages
  const index = roots.index
  const readChain = (sessionId: string) => readSessionFiles(roots.transcripts, sessionId, index)
  return {
    harness: 'claude',
    discoverSessions: (options) => discoverClaudeSessions(roots, options),
    readSessionFiles: readChain,
    backfillTick:
      index === undefined
        ? undefined
        : (batchSize) => backfillTick(roots.transcripts, index, batchSize),
    reconcileAll: index === undefined ? undefined : () => reconcileAll(roots.transcripts, index),
    resolveIndexedIds: index === undefined ? undefined : (ids) => resolveIds(index, ids),
    historyComplete: index === undefined ? undefined : () => historyComplete(index),
    searchIndexed: index === undefined ? undefined : (query) => searchIndexed(index, query),
    disposeFullRecords: (sessionId) => clearFullRecords(sessionId),
    readShellOutput: async (sessionId, shellId) => {
      const tail = await readShellOutput(await readChain(sessionId), shellId)
      return tail === null ? { state: 'absent' } : { state: 'available', tail }
    },
    readSubagentFiles: async (sessionId, subagentId) =>
      readSubagentChain(await readChain(sessionId), subagentId),
    readSubagentUsage: async (sessionId) => readSubagentTokens(await readChain(sessionId)),
    managedSessions: roots.managedSessions,
    isLockedElsewhere: roots.isLockedElsewhere,
    rename: roots.rename,
    overlayFor:
      liveMessages === undefined
        ? undefined
        : (sessionId) => {
            const held = aliases.get(sessionId) ?? new Map<string, string>()
            aliases.set(sessionId, held)
            return draftOverlay(liveMessages(sessionId), held)
          },
  }
}
