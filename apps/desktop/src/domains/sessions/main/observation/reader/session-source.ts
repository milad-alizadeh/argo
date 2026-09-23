// What one Harness adapter gives the shared Session reader (#2025): discovery, reading one Session's
// transcript chain, projecting a chain into Feed rows, and the optional capabilities only
// some CLIs supply today. Split from reader.ts so this and the discovery/feed-reading modules it
// depends on can reference the same shape without an import cycle. Archiving is not among them:
// Argo owns that flag for every Harness at once (`archive-store.ts`, #2315).
import type { SessionRenameReply, SessionRenameRequest } from '@/domains/sessions/contract/ipc'
import type { SessionFeedRow } from '@/domains/sessions/contract/model/feed/feed-rows'
import type { SessionRosterRow } from '@/domains/sessions/contract/model/models'
import type { SessionChain } from '@/domains/sessions/contract/model/transcript/chains'
import type {
  SessionShellOutput,
  SessionSubagentUsage,
} from '@/domains/sessions/contract/model/wire/background-work-contract'
import type { ResolvedIndexedIds } from '../../indexing/resolve-indexed-ids'
import type { BackfillProgress, TranscriptDiscovery } from './discover-transcript-sessions'

// What a driver shows over one Session's recorded Feed while a Turn streams: the rows to draw, and
// everything it changed about them, which the revision must cover. The row id convention an
// overlay matches against is the adapter's own, so this stays a capability the source supplies
// rather than a shape the reader interprets.
export type FeedOverlay = (rows: readonly SessionFeedRow[]) => {
  rows: SessionFeedRow[]
  changes: { rows: SessionFeedRow[]; aliases: [string, string][] }
}

export type ManagedFeed = {
  chainId: string
  revision: string
  rows: SessionFeedRow[]
}

// One adapter's page of the active roster (#2239): `cursor` names the window the caller already
// holds (or `null` for the bounded first page) and `projectRoot` scopes rows to one Project at
// the discovery boundary, before the reader ever sees a machine-wide list to filter down.
export type DiscoverSessionsOptions = {
  cursor?: string | null
  projectRoot?: string | null
}

export type SessionSource = {
  harness: string
  discoverSessions: (options?: DiscoverSessionsOptions) => Promise<TranscriptDiscovery>
  readSessionFiles: (sessionId: string) => Promise<SessionChain | null>
  // The renderer releases a Feed when its Session stops being selected. The adapter then drops
  // any full transcript records it only retained to incrementally project that selected Feed.
  disposeFullRecords?: (sessionId: string) => void
  managedSessions?: () => SessionRosterRow[]
  // The tail of one background Shell's recorded output, addressed by the call that started it
  // (#1582). Every harness declares this fact: Codex declares `absent` rather than leaving a
  // missing method for shared code to infer.
  readShellOutput: (sessionId: string, shellId: string) => Promise<SessionShellOutput>
  // One Subagent's own transcript, read as a chain so the Feed projects it the same way it
  // projects a Session's (#1582). Absent where the Harness records no Subagent transcript.
  readSubagentFiles?: (sessionId: string, subagentId: string) => Promise<SessionChain | null>
  // What each of this Session's Subagents used, keyed by the call that spawned it.
  readSubagentUsage?: (sessionId: string) => Promise<SessionSubagentUsage[]>
  // Another live Argo window on this machine holds the Session's channel right now (ADR-0040).
  // Joined over any lock discovery already read off the Harness's own live record; absent where the
  // Harness keeps no ownership ledger.
  isLockedElsewhere?: (sessionId: string) => boolean
  overlayFor?: (sessionId: string) => FeedOverlay | null
  // A managed Harness can project its live Feed directly, without materialising a private
  // transcript format for the shared reader to parse.
  readManagedFeed?: (sessionId: string) => ManagedFeed | null | undefined
  // A watched Harness can project vendor history directly. It is deliberately separate from a
  // managed Feed so history reads never make the shared reader treat the Session as owned.
  readObservedFeed?: (
    sessionId: string,
  ) => ManagedFeed | null | undefined | Promise<ManagedFeed | null | undefined>
  rename?: (request: SessionRenameRequest) => Promise<SessionRenameReply>
  // One more batch of this Harness's older history, and a full-tree reconcile (#2373). Present only
  // when the app's Session index is open: without one, discovery parses each window itself and
  // there is nothing for either to write.
  backfillTick?: (batchSize?: number) => Promise<BackfillProgress>
  reconcileAll?: () => Promise<{ filesParsed: number }>
  // Every id resolved straight off the index's persisted resume graph, with no discovery window
  // grown to find it (#2374). Present only alongside `backfillTick`: the same index that batches
  // older history in is what this reads back out.
  resolveIndexedIds?: (ids: readonly string[]) => Promise<ResolvedIndexedIds>
  // Whether this Harness's index has walked every file on disk at least once. False while background
  // backfill (#2373) still has older history left, so a caller resolving an id through the index
  // knows an unresolved id may only be un-indexed rather than truly gone.
  historyComplete?: () => Promise<boolean>
  // Every Session this Harness's index title, current id, or a retired id matches (#2375). Present
  // only alongside `resolveIndexedIds`: title/id search reads the same index backfill fills.
  searchIndexed?: (query: string) => Promise<SessionRosterRow[]>
}
