// What one CLI adapter gives the shared Session reader (#2025): discovery, reading one Session's
// transcript chain, projecting a chain into Feed rows, and the optional capabilities only
// some CLIs supply today. Split from reader.ts so this and the discovery/feed-reading modules it
// depends on can reference the same shape without an import cycle. Archiving is not among them:
// Argo owns that flag for every CLI at once (`archive-store.ts`, #2315).
import type { SessionDelegationUsage } from '../contract/background-work-contract'
import type { SessionChain } from '../contract/chains'
import type { SessionRenameReply, SessionRenameRequest } from '../contract/contract'
import type { SessionFeedRow, SessionRosterRow } from '../contract/models'
import type { BackfillProgress, TranscriptDiscovery } from './discover-transcript-sessions'
import type { ResolvedIndexedIds } from './resolve-indexed-ids'

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
  readDelegationUsage?: (sessionId: string) => Promise<SessionDelegationUsage[]>
  // Another live Argo window on this machine holds the Session's channel right now (ADR-0040).
  // Joined over any lock discovery already read off the CLI's own live record; absent where the
  // CLI keeps no ownership ledger.
  isLockedElsewhere?: (sessionId: string) => boolean
  overlayFor?: (sessionId: string) => FeedOverlay | null
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
  // One more batch of this CLI's older history, and a full-tree reconcile (#2373). Present only
  // when the app's Session index is open: without one, discovery parses each window itself and
  // there is nothing for either to write.
  backfillTick?: (batchSize?: number) => Promise<BackfillProgress>
  reconcileAll?: () => Promise<{ filesParsed: number }>
  // Every id resolved straight off the index's persisted resume graph, with no discovery window
  // grown to find it (#2374). Present only alongside `backfillTick`: the same index that batches
  // older history in is what this reads back out.
  resolveIndexedIds?: (ids: readonly string[]) => Promise<ResolvedIndexedIds>
  // Whether this CLI's index has walked every file on disk at least once. False while background
  // backfill (#2373) still has older history left, so a caller resolving an id through the index
  // knows an unresolved id may only be un-indexed rather than truly gone.
  historyComplete?: () => Promise<boolean>
  // Every Session this CLI's index title, current id, or a retired id matches (#2375). Present
  // only alongside `resolveIndexedIds`: title/id search reads the same index backfill fills.
  searchIndexed?: (query: string) => Promise<SessionRosterRow[]>
}
