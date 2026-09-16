import type { SessionFeedRow } from '../types'
import type { TurnMarkerView } from './turn-marker-state'

export type FeedLiveFacts = {
  compactionStartedAt: string | null
  compactionPercentage: number | null
  compactionTokens: string | null
  handoffStartedAt: string | null
  handoffTo: string | null
  isRunning: boolean
  optimisticRow: SessionFeedRow | null
  posture: 'managed' | 'external' | null
  turnMarker: TurnMarkerView | null
} | null

export const INACTIVE_FEED_LIVE_FACTS = {
  compactionStartedAt: null,
  compactionPercentage: null,
  compactionTokens: null,
  handoffStartedAt: null,
  handoffTo: null,
  isRunning: false,
  optimisticRow: null,
  posture: null,
  turnMarker: null,
} satisfies NonNullable<FeedLiveFacts>
