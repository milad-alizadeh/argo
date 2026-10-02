import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'

const sessionId = '00000000-0000-4000-8000-000000000001'

// One command's live content event, keyed by its content id.
export function liveContent(
  sequence: number,
  value: FeedContent,
  commandId = 'command-1',
): SessionLiveEvent {
  return {
    type: 'content',
    sessionId,
    sequence,
    commandId,
    turnId: 'turn-1',
    vendorEventId: value.id,
    content: value,
  }
}

// One command's live status event, which keys no row.
export function liveStatus(
  sequence: number,
  value: 'running' | 'idle',
  commandId = 'command-1',
): SessionLiveEvent {
  return {
    type: 'status',
    sessionId,
    sequence,
    commandId,
    turnId: 'turn-1',
    vendorEventId: null,
    status: value,
  }
}
