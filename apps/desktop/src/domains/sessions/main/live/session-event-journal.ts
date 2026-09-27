import {
  SESSION_LIVE_REPLAY_BYTE_LIMIT,
  SESSION_LIVE_REPLAY_EVENT_LIMIT,
  type SessionLiveEvent,
  type SessionLiveEventBody,
  sessionLiveEventBodySchema,
  sessionLiveEventSchema,
} from '@/domains/sessions/api/session-live-event'

export type SessionEventReplay =
  | { type: 'expired'; cursor: number }
  | { type: 'events'; events: SessionLiveEvent[]; cursor: number }

type RecordedEvent = { event: SessionLiveEvent; bytes: number }

export class SessionEventJournal {
  private readonly listeners = new Map<string, Set<(event: SessionLiveEvent) => void>>()
  private readonly cursors = new Map<string, number>()
  private readonly events: RecordedEvent[] = []
  private readonly limit: number
  private readonly byteLimit: number
  private usedBytes = 0

  constructor(limit = SESSION_LIVE_REPLAY_EVENT_LIMIT, byteLimit = SESSION_LIVE_REPLAY_BYTE_LIMIT) {
    if (!Number.isInteger(limit) || limit < 1)
      throw new Error('Session event limit must be positive.')
    if (!Number.isInteger(byteLimit) || byteLimit < 1)
      throw new Error('Session event byte limit must be positive.')
    this.limit = limit
    this.byteLimit = byteLimit
  }

  append(sessionId: string, value: SessionLiveEventBody): SessionLiveEvent {
    const body = sessionLiveEventBodySchema.parse(value)
    const sequence = (this.cursors.get(sessionId) ?? 0) + 1
    const event = sessionLiveEventSchema.parse({ sessionId, sequence, ...body })
    this.cursors.set(sessionId, sequence)
    const bytes = Buffer.byteLength(JSON.stringify(event), 'utf8')
    if (bytes <= this.byteLimit) {
      this.events.push({ event, bytes })
      this.usedBytes += bytes
      while (this.events.length > this.limit || this.usedBytes > this.byteLimit) {
        const removed = this.events.shift()
        if (removed !== undefined) this.usedBytes -= removed.bytes
      }
    }
    for (const listener of this.listeners.get(sessionId) ?? []) listener(event)
    return event
  }

  replay(sessionId: string, after: number): SessionEventReplay {
    if (!Number.isInteger(after) || after < 0) throw new Error('Session event cursor is invalid.')
    const cursor = this.cursors.get(sessionId) ?? 0
    const events = this.events.flatMap(({ event }) =>
      event.sessionId === sessionId && event.sequence > after ? [event] : [],
    )
    if (after > cursor || events.length !== cursor - after) return { type: 'expired', cursor }
    return { type: 'events', events, cursor }
  }

  subscribe(sessionId: string, listener: (event: SessionLiveEvent) => void): () => void {
    const listeners = this.listeners.get(sessionId) ?? new Set()
    listeners.add(listener)
    this.listeners.set(sessionId, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(sessionId)
    }
  }
}
