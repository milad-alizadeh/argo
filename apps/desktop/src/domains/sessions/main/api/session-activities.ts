import { projectFeedRowEntries } from '@/domains/sessions/api/feed'
import type { Harness } from '@/harnesses/harness'
import type { ExternalActivityReading } from '@/harnesses/registration'
import {
  type SessionUpdate,
  type SessionUpdateContext,
  updateHarnessSession,
} from './session-update'

export type HarnessSession = { harness: Harness; nativeId: string }
type SessionActivitiesOptions = {
  readActivity: (session: HarnessSession) => Promise<ExternalActivityReading>
  // Each reading after its activity line is queued, or null for a read that failed.
  read: (session: HarnessSession, reading: ExternalActivityReading | null) => void
  // A Session with no saved row yet, for discovery to add.
  unknown: (session: HarnessSession) => void
}

// Each Session's row reaches SQLite at most once a window, with its newest values.
const WRITE_WINDOW_MS = 500

// A Session waiting its turn, being read, or being read with one more read asked for after it.
type ReadState = 'queued' | 'reading' | 'again'

export const sessionKey = (session: HarnessSession) => `${session.harness}\u0000${session.nativeId}`

// External Session rows: every update merges into one write per Session a window. Activity reads
// run one at a time across every Session, since one vendor read can take a large file whole.
export class SessionActivities {
  readonly #context: SessionUpdateContext
  readonly #options: SessionActivitiesOptions
  readonly #pending = new Map<string, { session: HarnessSession; update: SessionUpdate }>()
  readonly #reads = new Map<string, ReadState>()
  readonly #queue: HarnessSession[] = []
  #running = false
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
    this.#timer ??= setTimeout(() => this.flush(), WRITE_WINDOW_MS)
  }

  // Asks for a read. A Session already queued is read once; one being read is read once more after.
  read(session: HarnessSession): void {
    if (this.#stopped || !this.#asksForRead(sessionKey(session))) return
    this.#queue.push(session)
    void this.#drain()
  }

  // Whether a new read starts, after recording the ask against the Session's read state.
  #asksForRead(key: string): boolean {
    const state = this.#reads.get(key) ?? 'idle'
    switch (state) {
      case 'idle':
        this.#reads.set(key, 'queued')
        return true
      case 'reading':
        this.#reads.set(key, 'again')
        return false
      case 'queued':
      case 'again':
        return false
      default:
        return state satisfies never
    }
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
    this.#queue.length = 0
    this.#reads.clear()
  }

  async #drain(): Promise<void> {
    if (this.#running) return
    this.#running = true
    try {
      for (let session = this.#queue.shift(); session !== undefined; session = this.#queue.shift())
        await this.#readOne(session)
    } finally {
      this.#running = false
    }
  }

  async #readOne(session: HarnessSession): Promise<void> {
    const key = sessionKey(session)
    this.#reads.set(key, 'reading')
    let reading: ExternalActivityReading | null = null
    try {
      reading = await this.#options.readActivity(session)
    } catch (error) {
      // A failed read keeps the stored line.
      console.warn('Could not read an external Session activity:', error)
    }
    this.#receive(session, reading)
    const again = this.#reads.get(key) === 'again'
    this.#reads.delete(key)
    if (again) this.read(session)
  }

  // The line is the newest Turn's activity by the Feed's own rules; none keeps the stored line.
  #receive(session: HarnessSession, reading: ExternalActivityReading | null): void {
    if (this.#stopped) return
    const activity =
      reading === null ? null : projectFeedRowEntries({ history: reading.turn, live: [] }).activity
    if (activity !== null) this.update(session, { activity })
    this.#options.read(session, reading)
  }
}
