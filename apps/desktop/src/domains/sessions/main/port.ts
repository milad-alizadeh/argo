// The Session-owned observation port. A Harness builds one source through this public boundary;
// the private reader composes those sources at the application root.
export type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
export { discoverRoster } from '@/domains/sessions/main/observation/discover-roster'
export type {
  FeedOverlay,
  SessionSource,
} from '@/domains/sessions/main/observation/session-source'
