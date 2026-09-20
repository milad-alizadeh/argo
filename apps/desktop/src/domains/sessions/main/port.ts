// The Session-owned observation port. A Harness builds one source through this public boundary;
// the private reader composes those sources at the application root.
export type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
export { isLiveElsewhere } from '@/domains/sessions/main/lifecycle/live-elsewhere'
export { LIVE_ACTIVITY_SILENCE_MS } from '@/domains/sessions/main/lifecycle/liveness'
export { managedRow } from '@/domains/sessions/main/lifecycle/managed-row'
export {
  createOwnershipLedger,
  isProcessAlive,
  type OwnershipLedger,
  type OwnershipStanding,
} from '@/domains/sessions/main/lifecycle/ownership-ledger'
export { rollupSessionStatus } from '@/domains/sessions/main/lifecycle/session-status-rollup'
export { discoverRoster } from '@/domains/sessions/main/observation/discover-roster'
export {
  createTranscriptDiscoverer,
  type TranscriptDiscovery,
  type TranscriptDiscoveryOptions,
} from '@/domains/sessions/main/observation/discover-transcript-sessions'
export type {
  FeedOverlay,
  SessionSource,
} from '@/domains/sessions/main/observation/session-source'
export {
  createTranscriptRecordReader,
  ROSTER_FILE_LIMIT,
} from '@/domains/sessions/main/observation/transcript-lines'
export { rowsOfRecord } from '@/domains/sessions/main/projection/feed'
export { readPlanSnapshot, readPlanStatus } from '@/domains/sessions/main/projection/plan'
export {
  chainBackgroundTasks,
  chainMessages,
  projectRosterRow,
} from '@/domains/sessions/main/projection/roster'
export { pendingAskCall } from '@/domains/sessions/main/projection/status'
export { hasOpenSubagent } from '@/domains/sessions/main/projection/subagents'
