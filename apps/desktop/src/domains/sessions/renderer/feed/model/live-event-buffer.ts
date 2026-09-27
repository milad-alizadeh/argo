import {
  SESSION_LIVE_REPLAY_BYTE_LIMIT,
  SESSION_LIVE_REPLAY_EVENT_LIMIT,
  type SessionLiveEvent,
} from '@/domains/sessions/api/session-live-event'

export type LiveEventBuffer = {
  events: SessionLiveEvent[]
  eventSizes: number[]
  eventBytes: number
}

const encoder = new TextEncoder()

export function emptyLiveEventBuffer(): LiveEventBuffer {
  return { events: [], eventSizes: [], eventBytes: 0 }
}

function sameAssistantMessage(left: SessionLiveEvent, right: SessionLiveEvent): boolean {
  return (
    left.type === 'content' &&
    right.type === 'content' &&
    left.content.kind === 'message' &&
    right.content.kind === 'message' &&
    left.content.role === 'assistant' &&
    right.content.role === 'assistant' &&
    left.sessionId === right.sessionId &&
    left.content.id === right.content.id
  )
}

export function retainLiveEvent(
  current: LiveEventBuffer | null,
  event: SessionLiveEvent,
): LiveEventBuffer {
  const events = [...(current?.events ?? [])]
  const eventSizes = [...(current?.eventSizes ?? [])]
  let eventBytes = current?.eventBytes ?? 0
  if (event.type === 'content' && event.content.kind === 'message') {
    const first = events.findIndex((candidate) => sameAssistantMessage(candidate, event))
    const latest = events.findLastIndex((candidate) => sameAssistantMessage(candidate, event))
    if (latest > first) {
      events.splice(latest, 1)
      const removed = eventSizes.splice(latest, 1)[0]
      if (removed === undefined) throw new Error('Live event buffer lost its byte count.')
      eventBytes -= removed
    }
  }
  const bytes = encoder.encode(JSON.stringify(event)).byteLength
  events.push(event)
  eventSizes.push(bytes)
  eventBytes += bytes
  while (
    events.length > SESSION_LIVE_REPLAY_EVENT_LIMIT ||
    (events.length > 1 && eventBytes > SESSION_LIVE_REPLAY_BYTE_LIMIT)
  ) {
    events.shift()
    const removed = eventSizes.shift()
    if (removed === undefined) throw new Error('Live event buffer lost its byte count.')
    eventBytes -= removed
  }
  return { events, eventSizes, eventBytes }
}
