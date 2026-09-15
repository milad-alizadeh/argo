// The Claude source the shared Session reader drives (#2025). Transcripts are read-only. The one
// exception is the archive flag (#2194): `setArchivedSessions` writes it back into the Claude
// desktop app's own store, the same file `discoverArchivedSessions` reads (`sessions/archive.ts`).
import type { SessionReader } from '@/core/sessions/bridge'
import type { SessionRenameReply, SessionRenameRequest } from '@/core/sessions/contract'
import { mergeManagedRoster } from '@/core/sessions/managed-row'
import type { SessionRosterRow } from '@/core/sessions/models'
import { createSessionReader, type SessionSource } from '@/core/sessions/reader'
import { compactionEndedAt, markCompactingRows } from '../../compaction/compaction-roster'
import type { LiveMessage } from '../drive/live-messages'
import {
  clearFullRecords,
  discoverArchivedSessions,
  discoverSessions,
  readSessionFiles,
  setArchivedSessions,
} from './discover'
import { projectFeed } from './feed'
import { draftOverlay } from './live-feed'
import { readShellOutput } from './shell-output'
import { readDelegationChain, readDelegationTokens } from './subagents'

async function completeCompactions(
  transcripts: string,
  sessions: SessionRosterRow[],
  complete: ((sessionId: string, completedAt: string) => void) | undefined,
) {
  if (complete === undefined) return
  for (const session of sessions) {
    const startedAt = session.compactionStartedAt
    if (startedAt === null || startedAt === undefined) continue
    const chain = await readSessionFiles(transcripts, session.id)
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

// Two roots, because the two readings live in two places: the transcripts the CLI writes, and the
// Claude desktop app's own store, which is where the archive flag already lives. `archive` is
// optional: a machine without that app installed reads no archived Sessions rather than failing.
export function claudeSessionSource(roots: {
  transcripts: string
  archive?: string
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
}): SessionSource {
  const aliases = new Map<string, Map<string, string>>()
  const liveMessages = roots.liveMessages
  const archiveRoot = roots.archive
  return {
    cli: 'claude',
    discoverSessions: async () => {
      roots.completeHandoffs?.()
      const discovered = await discoverSessions(roots.transcripts, roots.archive)
      const managed = roots.managedSessions?.() ?? []
      await completeCompactions(roots.transcripts, managed, roots.completeCompaction)
      const roster = mergeManagedRoster(discovered, managed)
      const rows = await markCompactingRows(roster.rows, {
        folder: roots.compactionStarts,
        readChain: (sessionId) => readSessionFiles(roots.transcripts, sessionId),
        begin: roots.beginCompaction,
      })
      return { ...roster, rows: withHandoffEdges(rows, roots.handoffEdges) }
    },
    readSessionFiles: (sessionId) => readSessionFiles(roots.transcripts, sessionId),
    disposeFullRecords: (sessionId) => clearFullRecords(sessionId),
    readShellOutput: async (sessionId, shellId) =>
      readShellOutput(await readSessionFiles(roots.transcripts, sessionId), shellId),
    readDelegationFiles: async (sessionId, delegationId) =>
      readDelegationChain(await readSessionFiles(roots.transcripts, sessionId), delegationId),
    readDelegationUsage: async (sessionId) =>
      readDelegationTokens(await readSessionFiles(roots.transcripts, sessionId)),
    projectFeed,
    managedSessions: roots.managedSessions,
    isLockedElsewhere: roots.isLockedElsewhere,
    rename: roots.rename,
    discoverArchivedSessions:
      archiveRoot === undefined
        ? undefined
        : (options) => discoverArchivedSessions(roots.transcripts, archiveRoot, options),
    setArchived:
      archiveRoot === undefined
        ? undefined
        : ({ ids, archived }) =>
            setArchivedSessions(roots.transcripts, archiveRoot, { ids, archived }),
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

export function createClaudeSessionReader(roots: {
  transcripts: string
  archive?: string
  managedSessions?: () => SessionRosterRow[]
  compactionStarts?: string
  liveMessages?: (sessionId: string) => LiveMessage[]
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
  isLockedElsewhere?: (sessionId: string) => boolean
}): SessionReader {
  return createSessionReader([claudeSessionSource(roots)])
}
