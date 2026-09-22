// The Session-owned observation port. A Harness builds one source through this public boundary;
// the private reader composes those sources at the application root.
export type {
  BackfillProgress,
  boundIndexedWindow,
  ResolvedIndexedIds,
  SessionIndex,
  TranscriptFileIdentity,
  TranscriptPath,
} from './indexing'
export {
  createBackgroundIndexing,
  createFullRecordTracker,
  createIndexedReadHarness,
  createIndexedWindow,
  createWorkerSessionIndex,
  discoverIndexedWindow,
  expectAnsweredByIndex,
  finishBackfill,
  freshIdentityOf,
  holdsMessage,
  indexedAdapters,
  isSessionIndexFallback,
  manyTranscripts,
  openSessionIndex,
  presentedRows,
  reindexCandidates,
  resolveIndexedIds,
  sessionIdAt,
  sessionIndexPath,
  startBackfill,
  withReconcile,
} from './indexing'
export {
  createOwnershipLedger,
  isLiveElsewhere,
  isProcessAlive,
  LIVE_ACTIVITY_SILENCE_MS,
  managedRow,
  type OwnershipLedger,
  type OwnershipStanding,
  rollupSessionStatus,
} from './lifecycle'
export type {
  FeedOverlay,
  SessionSource,
} from './observation'
export {
  createTranscriptDiscoverer,
  createTranscriptRecordReader,
  discoverRoster,
  ROSTER_FILE_LIMIT,
  type TranscriptDiscovery,
  type TranscriptDiscoveryOptions,
} from './observation'
export {
  chainBackgroundTasks,
  chainMessages,
  hasOpenSubagent,
  pendingAskCall,
  projectRosterRow,
  readPlanSnapshot,
  readPlanStatus,
  rowsOfRecord,
} from './projection'
