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
  // Each reading, after its activity line is queued.
  read: (session: HarnessSession, reading: ExternalActivityReading) => void
  // A Session with no saved row yet, for discovery to add.
  unknown: (session: HarnessSession) => void
  // Each Session's row reaches SQLite at most once a window, with its newest values.
  writeMs?: number
}

// A Session waiting its turn, being read, or being read with one more read asked for after it.
type ReadState = 'queued' | 'reading' | 'again'

const sessionKey = (session: HarnessSession) => `${session.harness}\u0000${session.nativeId}`

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
    this.#timer ??= setTimeout(() => this.flush(), this.#options.writeMs ?? 500)
  }

  // Asks for a read. A Session already queued is read once; one being read is read once more after.
  read(session: HarnessSession): void {
    if (this.#stopped) return
    const key = sessionKey(session)
    const state = this.#reads.get(key)
    if (state === 'reading') this.#reads.set(key, 'again')
    if (state !== undefined) return
    this.#reads.set(key, 'queued')
    this.#queue.push(session)
    void this.#drain()
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
    try {
      this.#receive(session, await this.#options.readActivity(session))
    } catch (error) {
      // A failed read keeps the stored line.
      console.warn('Could not read an external Session activity:', error)
    }
    const again = this.#reads.get(key) === 'again'
    this.#reads.delete(key)
    if (again) this.read(session)
  }

  #receive(session: HarnessSession, reading: ExternalActivityReading): void {
    if (this.#stopped) return
    if (reading.activity !== null) this.update(session, { activity: reading.activity })
    this.#options.read(session, reading)
  }
}
