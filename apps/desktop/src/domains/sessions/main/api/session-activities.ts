import type { Harness } from '@/harnesses/harness'
import type { TranscriptLines, TranscriptReading } from '@/harnesses/registration'
import {
  type SessionUpdate,
  type SessionUpdateContext,
  updateHarnessSession,
} from './session-update'

export type HarnessSession = { harness: Harness; nativeId: string }
type SessionActivitiesOptions = {
  readTranscript: (session: HarnessSession, lines: TranscriptLines) => Promise<TranscriptReading>
  // Each reading, after its activity line is queued.
  read: (session: HarnessSession, reading: TranscriptReading) => void
  // A Session with no saved row yet, for discovery to add.
  unknown: (session: HarnessSession) => void
  // Each Session's row reaches SQLite at most once a window, with its newest values.
  writeMs?: number
}

const sessionKey = (session: HarnessSession) => `${session.harness}\u0000${session.nativeId}`

// Lines that arrive during a read join the ones already waiting; a reset drops those.
function joinLines(waiting: TranscriptLines | undefined, next: TranscriptLines): TranscriptLines {
  if (waiting === undefined || !next.continued) return next
  return { lines: [...waiting.lines, ...next.lines], continued: waiting.continued }
}

// External Session rows: every update merges into one write per Session a window, and each
// Session's new transcript lines are read one batch at a time.
export class SessionActivities {
  readonly #context: SessionUpdateContext
  readonly #options: SessionActivitiesOptions
  readonly #pending = new Map<string, { session: HarnessSession; update: SessionUpdate }>()
  // Sessions with a read in flight, and the lines that arrived during it.
  readonly #reading = new Map<string, TranscriptLines | undefined>()
  #timer: ReturnType<typeof setTimeout> | null = null
  #stopped = false

  constructor(context: SessionUpdateContext, options: SessionActivitiesOptions) {
    this.#context = context
    this.#options = options
  }

  update(session: HarnessSession, update: SessionUpdate): void {
    if (this.#stopped) return
    const key = sessionKey(session)
    const pending = this.#pending.get(key)?.update
    this.#pending.set(key, { session, update: { ...pending, ...update } })
    this.#timer ??= setTimeout(() => this.flush(), this.#options.writeMs ?? 500)
  }

  // Reads the lines now, or after the read in flight for the same Session ends.
  read(session: HarnessSession, lines: TranscriptLines): void {
    if (this.#stopped) return
    const key = sessionKey(session)
    if (this.#reading.has(key)) {
      this.#reading.set(key, joinLines(this.#reading.get(key), lines))
      return
    }
    this.#reading.set(key, undefined)
    this.#options
      .readTranscript(session, lines)
      .then(
        (reading) => this.#receive(session, reading),
        (error: unknown) => console.warn('Could not read an external Session transcript:', error),
      )
      .finally(() => {
        const waiting = this.#reading.get(key)
        this.#reading.delete(key)
        if (waiting !== undefined) this.read(session, waiting)
      })
  }

  flush(): void {
    if (this.#timer !== null) clearTimeout(this.#timer)
    this.#timer = null
    const pending = [...this.#pending.values()]
    this.#pending.clear()
    for (const { session, update } of pending)
      if (!updateHarnessSession(this.#context, session, update)) this.#options.unknown(session)
  }

  stop(): void {
    this.flush()
    this.#stopped = true
    this.#reading.clear()
  }

  #receive(session: HarnessSession, reading: TranscriptReading): void {
    if (this.#stopped) return
    // An idle Session keeps the last line it showed.
    if (reading.activity !== null) this.update(session, { activity: reading.activity })
    this.#options.read(session, reading)
  }
}
