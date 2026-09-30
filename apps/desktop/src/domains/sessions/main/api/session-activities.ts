import { FeedRowProjector, type LiveActivity } from '@/domains/sessions/api/feed'
import type {
  SessionLiveEvent,
  SessionLiveEventBody,
} from '@/domains/sessions/api/session-live-event'
import type { Harness } from '@/harnesses/harness'
import type { HistoryActivityReading } from '@/harnesses/registration'
import { type SessionUpdateContext, updateHarnessSession } from './session-update'

// Each Session's activity line reaches SQLite at most once a window, as its newest value.
const ACTIVITY_WRITE_MS = 500
// The newest events a Session keeps once its current Turn's prompt lies further back.
const RETAINED_EVENTS = 500

type HarnessSession = { harness: Harness; nativeId: string }
type SessionTurn = { session: HarnessSession; events: SessionLiveEvent[]; sequence: number }

function isPrompt(event: SessionLiveEventBody): boolean {
  return (
    event.type === 'content' && event.content.kind === 'message' && event.content.role === 'user'
  )
}

// The events of a Session's current Turn, from the newest prompt on, which is all the activity
// line reads.
function currentTurn(events: SessionLiveEvent[]): SessionLiveEvent[] {
  const prompt = events.findLastIndex(isPrompt)
  const turn = prompt < 0 ? events : events.slice(prompt)
  return turn.length > RETAINED_EVENTS ? turn.slice(-RETAINED_EVENTS) : turn
}

// The activity line of each Session a history watcher reads, found by the Feed's own rules from
// the lines the watcher already decoded, and stored so the Session List opens no Feed reader.
export class SessionActivities {
  readonly #context: SessionUpdateContext
  readonly #writeMs: number
  readonly #turns = new Map<string, SessionTurn>()
  readonly #pending = new Map<string, { session: HarnessSession; activity: LiveActivity | null }>()
  #timer: ReturnType<typeof setTimeout> | null = null

  constructor(context: SessionUpdateContext, writeMs = ACTIVITY_WRITE_MS) {
    this.#context = context
    this.#writeMs = writeMs
  }

  // A reading with no content leaves the stored line as it is, and so does an append with nothing
  // before it here that finds no activity, since it cannot see where its Turn began.
  publish(session: HarnessSession, { restarted, events }: HistoryActivityReading): void {
    if (!events.some((event) => event.type === 'content')) return
    const key = `${session.harness}\u0000${session.nativeId}`
    const previous = restarted ? undefined : this.#turns.get(key)
    let sequence = previous?.sequence ?? 0
    const read = events.map((event): SessionLiveEvent => {
      sequence += 1
      return { ...event, sessionId: session.nativeId, sequence }
    })
    const turn = { session, events: currentTurn([...(previous?.events ?? []), ...read]), sequence }
    this.#turns.set(key, turn)
    const { activity } = new FeedRowProjector().project({ history: [], live: turn.events })
    if (activity === null && previous === undefined && !restarted) return
    this.#pending.set(key, { session, activity })
    this.#timer ??= setTimeout(() => this.flush(), this.#writeMs)
  }

  // Writes each Session's newest line; a Session never saved keeps no Turn here.
  flush(): void {
    if (this.#timer !== null) clearTimeout(this.#timer)
    this.#timer = null
    const pending = [...this.#pending]
    this.#pending.clear()
    for (const [key, { session, activity }] of pending)
      if (!updateHarnessSession(this.#context, session, { activity })) this.#turns.delete(key)
  }

  stop(): void {
    this.flush()
    this.#turns.clear()
  }
}
