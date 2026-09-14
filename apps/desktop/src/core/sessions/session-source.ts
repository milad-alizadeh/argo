// What one CLI adapter gives the shared Session reader (#2025): discovery, reading one Session's
// transcript chain, projecting a chain into Feed rows, and the two optional capabilities only
// some CLIs supply today. Split from reader.ts so this and the discovery/feed-reading modules it
// depends on can reference the same shape without an import cycle.
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

// One page of a source's Archived Sessions (#1593): `restored` names the row for `restoreId`
// when the caller passed one, whether or not it fell inside this page — the Archive section can
// then open already showing a Session a reader had selected before, rather than requiring a page
// through everything to find it.
export type ArchivedSessionsPage = {
  rows: SessionRosterRow[]
  nextCursor: string | null
  restored: SessionRosterRow | null
}

export type SessionSource = {
  cli: string
  discoverSessions: () => Promise<TranscriptDiscovery>
  readSessionFiles: (sessionId: string) => Promise<SessionChain | null>
  projectFeed: (chain: SessionChain) => SessionFeedRow[]
  managedSessions?: () => SessionRosterRow[]
  overlayFor?: (sessionId: string) => FeedOverlay | null
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
  // Absent where the CLI has no archive concept of its own (Codex, today): the reader then
  // answers every archive-list request with an empty page rather than guessing at one.
  discoverArchivedSessions?: (options: {
    cursor: string | null
    restoreId: string | null
  }) => Promise<ArchivedSessionsPage>
}
