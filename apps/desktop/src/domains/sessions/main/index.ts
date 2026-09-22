// The Session-owned observation port. A Harness builds one source through this public boundary;
// the private reader composes those sources at the application root.
export type { SessionIndex } from './indexing'
export { isLiveElsewhere } from './lifecycle'
export { LIVE_ACTIVITY_SILENCE_MS } from './lifecycle'
export { managedRow } from './lifecycle'
export {
  createOwnershipLedger,
  isProcessAlive,
  type OwnershipLedger,
  type OwnershipStanding,
} from './lifecycle'
export { rollupSessionStatus } from './lifecycle'
export { discoverRoster } from './observation'
export {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
  type TranscriptDiscoveryOptions,
} from './observation'
export type {
  FeedOverlay,
  SessionSource,
} from './observation'
export {
  createTranscriptRecordReader,
  ROSTER_FILE_LIMIT,
} from './observation'
export { rowsOfRecord } from './projection'
export { readPlanSnapshot, readPlanStatus } from './projection'
export {
  chainBackgroundTasks,
  chainMessages,
  projectRosterRow,
} from './projection'
export { pendingAskCall } from './projection'
export { hasOpenSubagent } from './projection'
export { createWorkerSessionIndex } from './indexing'
export { sessionIndexPath } from './indexing'
export { openSessionIndex } from './indexing'
export { startBackfill } from './indexing'
export { withReconcile } from './indexing'
export type { TranscriptFileIdentity } from './indexing'
export type { TranscriptPath } from './indexing'
export type { BackfillProgress } from './indexing'
export { isSessionIndexFallback } from './indexing'
export type { ResolvedIndexedIds } from './indexing'
export { freshIdentityOf } from './indexing'
export { resolveIndexedIds } from './indexing'
export { reindexCandidates } from './indexing'
export { createIndexedWindow } from './indexing'
export { createFullRecordTracker } from './indexing'
export { holdsMessage } from './indexing'
export type { boundIndexedWindow } from './indexing'
export { discoverIndexedWindow } from './indexing'
export { presentedRows } from './indexing'
export { createBackgroundIndexing } from './indexing'
export { indexedAdapters } from './indexing'
export { manyTranscripts } from './indexing'
export { sessionIdAt } from './indexing'
export { createIndexedReadHarness } from './indexing'
export { expectAnsweredByIndex } from './indexing'
export { finishBackfill } from './indexing'
