// What one CLI adapter gives the shared Session reader (#2025): discovery, reading one Session's
// transcript chain, projecting a chain into Feed rows, and the optional capabilities only
// some CLIs supply today. Split from reader.ts so this and the discovery/feed-reading modules it
// depends on can reference the same shape without an import cycle. Archiving is not among them:
// Argo owns that flag for every CLI at once (`storage/session-archive.ts`, #2315).
import type { SessionChain } from './chains'
import type { SessionRenameReply, SessionRenameRequest } from './contract'
import type { TranscriptDiscovery } from './discover-transcript-sessions'
import type { SessionFeedRow, SessionRosterRow } from './models'

// What a driver shows over one Session's recorded Feed while a Turn streams: the rows to draw, and
// everything it changed about them, which the revision must cover. The row id convention an
// overlay matches against is the adapter's own, so this stays a capability the source supplies
// rather than a shape the reader interprets.
export type FeedOverlay = (rows: readonly SessionFeedRow[]) => {
  rows: SessionFeedRow[]
  changes: unknown
}

// One adapter's page of the active roster (#2239): `cursor` names the window the caller already
// holds (or `null` for the bounded first page) and `projectRoot` scopes rows to one Project at
// the discovery boundary, before the reader ever sees a machine-wide list to filter down.
export type DiscoverSessionsOptions = {
  cursor?: string | null
  projectRoot?: string | null
}

export type SessionSource = {
  cli: string
  discoverSessions: (options?: DiscoverSessionsOptions) => Promise<TranscriptDiscovery>
  readSessionFiles: (sessionId: string) => Promise<SessionChain | null>
  // The renderer releases a Feed when its Session stops being selected. The adapter then drops
  // any full transcript records it only retained to incrementally project that selected Feed.
  disposeFullRecords?: (sessionId: string) => void
  managedSessions?: () => SessionRosterRow[]
  // The tail of one background Shell's recorded output, addressed by the call that started it
  // (#1582). Absent where the CLI records no output source, which is every CLI but Claude today.
  readShellOutput?: (sessionId: string, shellId: string) => Promise<string | null>
  // One Subagent's own transcript, read as a chain so the Feed projects it the same way it
  // projects a Session's (#1582). Absent where the CLI records no Subagent transcript.
  readDelegationFiles?: (sessionId: string, delegationId: string) => Promise<SessionChain | null>
  // What each of this Session's Subagents used, keyed by the call that spawned it.
  readDelegationUsage?: (
    sessionId: string,
  ) => Promise<{ id: string; tokens: number | null; model: string | null }[]>
  // Another live Argo window on this machine holds the Session's channel right now (ADR-0040).
  // Joined over any lock discovery already read off the CLI's own live record; absent where the
  // CLI keeps no ownership ledger.
  isLockedElsewhere?: (sessionId: string) => boolean
  overlayFor?: (sessionId: string) => FeedOverlay | null
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
}
