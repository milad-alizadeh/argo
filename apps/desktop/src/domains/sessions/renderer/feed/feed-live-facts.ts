import type { Session, SessionFeedRow, SessionId } from '@/domains/sessions/renderer/types'
import type { TurnMarkerView } from './turn-marker-state'

export type FeedLiveFacts = {
  compactionStartedAt: string | null
  compactionPercentage: number | null
  compactionTokens: string | null
  handoffStartedAt: string | null
  handoffTo: SessionId | null
  isRunning: boolean
  status: Session['status'] | null
  // What the Session is doing now, the same fact the roster draws under its title.
  activity: Session['activity']
  optimisticRow: SessionFeedRow | null
  posture: Session['posture'] | null
  settledPromptRow: SessionFeedRow | null
  turnMarker: TurnMarkerView | null
} | null

export const INACTIVE_FEED_LIVE_FACTS = {
  compactionStartedAt: null,
  compactionPercentage: null,
  compactionTokens: null,
  handoffStartedAt: null,
  handoffTo: null,
  isRunning: false,
  status: null,
  activity: null,
  optimisticRow: null,
  posture: null,
  settledPromptRow: null,
  turnMarker: null,
} satisfies NonNullable<FeedLiveFacts>
