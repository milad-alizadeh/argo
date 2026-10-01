import { stat } from 'node:fs/promises'
import { and, eq, lte, ne, notInArray, type SQL, sql } from 'drizzle-orm'
import { sessionTable } from '@/database/session/schema'
import { projectFeedRowEntries } from '@/domains/sessions/api/feed'
import { type Harness, type HarnessSession, harnessSessionKey } from '@/harnesses/harness'
import type {
  ExternalActivityReading,
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
} from '@/harnesses/registration'
import {
  harnessSessionId,
  type SessionUpdate,
  type SessionUpdateContext,
  updateHarnessSession,
} from './session-update'

const EXTERNAL_POLL_MS = 2_000
// A killed terminal writes nothing more, so a read-settled running status this quiet shows unknown.
export const RUNNING_QUIET_LIMIT_MS = 5 * 60_000
// Each Session's row reaches SQLite at most once a window, with its newest values.
const WRITE_WINDOW_MS = 500

export type ExternalSessionPollContext = SessionUpdateContext & {
  harnesses: readonly { harness: Harness; external: ExternalSessions }[]
  // Whether Argo runs a saved Session now; its live channel then owns its status and activity.
  hasLiveChannel: (sessionId: string) => boolean
  // A live external Session with no saved row.
  discover: (session: HarnessSession) => void
}

// What a transcript stat compares between ticks; Argo reads none of the file's content.
type TranscriptStamp = { inode: number; size: number; modifiedMs: number }

type TrackedSession = {
  transcript: string | null
  // The transcript's last stat; null until the first one, which only records it.
  stamp: TranscriptStamp | null
  // The status the listing gave this tick; null when only an activity read can tell.
  listed: ExternalSessionStatus | null
  // The status the newest activity read settled; null until a read settles one.
  status: ExternalSessionStatus | null
  // When the transcript last changed, or when the Session was first seen live.
  changedAt: number
  // The status last queued; null queues it again on the next tick.
  shown: ExternalSessionStatus | null
  // The last read could not answer yet, so the next tick reads again.
  retry: boolean
  discovered: boolean
}

// A Session waiting its turn, being read, or being read with one more read asked for after it.
type ReadState = 'queued' | 'reading' | 'again'

async function stampOf(transcript: string): Promise<TranscriptStamp | null> {
  try {
    const { ino, size, mtimeMs } = await stat(transcript)
    return { inode: ino, size, modifiedMs: mtimeMs }
  } catch {
    return null
  }
}

const sameStamp = (left: TranscriptStamp, right: TranscriptStamp) =>
  left.inode === right.inode && left.size === right.size && left.modifiedMs === right.modifiedMs

// A read's status outranks the listed one. A read-settled running status whose transcript has not
// changed for the quiet limit shows unknown; a listed status is fresh from every tick.
function shownStatus(tracked: TrackedSession, at: number): ExternalSessionStatus | null {
  const { status } = tracked
  if (status === null) return tracked.listed
  return status === 'running' && at - tracked.changedAt >= RUNNING_QUIET_LIMIT_MS
    ? 'unknown'
    : status
}

// The stored status and activity of Sessions that run outside Argo, from one poll. Each tick lists
// every Harness's live external Sessions, stats each transcript, asks the Harness about each one
// that changed or left, and diffs the list against the last tick's. The first sight of a transcript
// only records its stamp, so startup reads nothing. Updates merge into one write per Session a
// window, and activity reads run one at a time, since one vendor read can take a large file whole.
export class ExternalSessionPoll {
  readonly #context: ExternalSessionPollContext
  readonly #external: ReadonlyMap<Harness, ExternalSessions>
  // The newest row before this run; an upsert keeps a row's rowid, and a new row gets a higher one.
  readonly #lastEarlierRow: number
  // Each Harness's live Sessions at its last tick; absent before its first.
  readonly #live = new Map<Harness, Map<string, TrackedSession>>()
  // Sessions that left the list and wait for their last read, by Harness and native ID.
  readonly #leaving = new Map<string, TrackedSession>()
  // Harnesses whose last listing failed, so a failure is reported once until one succeeds.
  readonly #failing = new Set<Harness>()
  readonly #pending = new Map<string, { session: HarnessSession; update: SessionUpdate }>()
  readonly #reads = new Map<string, ReadState>()
  readonly #queue: HarnessSession[] = []
  #reading = false
  #writeTimer: ReturnType<typeof setTimeout> | null = null
  #ticking: Promise<void> | null = null
  #interval: ReturnType<typeof setInterval> | null = null
  #stopped = false

  constructor(context: ExternalSessionPollContext) {
    this.#context = context
    this.#external = new Map(context.harnesses.map(({ harness, external }) => [harness, external]))
    this.#lastEarlierRow =
      context.database.select({ rowid: sql<number | null>`max(rowid)` }).from(sessionTable).get()
        ?.rowid ?? 0
  }

  start(): void {
    void this.tick()
    this.#interval = setInterval(() => void this.tick(), EXTERNAL_POLL_MS)
  }

  // One tick at a time; a call during a tick waits for that tick.
  tick(): Promise<void> {
    if (this.#stopped) return Promise.resolve()
    this.#ticking ??= this.#tickAll().finally(() => {
      this.#ticking = null
    })
    return this.#ticking
  }

  // Writes what is queued now, for a test or a shutdown that cannot wait for the window.
  flush(): void {
    if (this.#writeTimer !== null) clearTimeout(this.#writeTimer)
    this.#writeTimer = null
    const pending = [...this.#pending.values()]
    this.#pending.clear()
    for (const { session, update } of pending)
      if (!updateHarnessSession(this.#context, session, update)) {
        // A write for a Session with no row yet queues its status again for when the row exists.
        const tracked = this.#tracked(session)
        if (tracked !== undefined) tracked.shown = null
      }
  }

  stop(): void {
    this.flush()
    this.#stopped = true
    if (this.#interval !== null) clearInterval(this.#interval)
    this.#queue.length = 0
    this.#reads.clear()
  }

  async #tickAll(): Promise<void> {
    for (const { harness, external } of this.#context.harnesses) {
      try {
        await this.#tickHarness(harness, external)
        this.#failing.delete(harness)
      } catch (error) {
        // The rows keep what they show, since a failed listing says nothing about any Session.
        if (!this.#failing.has(harness))
          console.warn(`Could not list ${harness} external Sessions:`, error)
        this.#failing.add(harness)
      }
    }
  }

  async #tickHarness(harness: Harness, external: ExternalSessions): Promise<void> {
    const list = await external.listLive()
    if (this.#stopped) return
    if (list.rejected > 0)
      console.warn(`Rejected ${list.rejected} unrecognised ${harness} live Session record(s).`)
    const previous = this.#live.get(harness)
    const current = new Map<string, TrackedSession>()
    this.#live.set(harness, current)
    for (const listed of list.sessions) {
      const session = { harness, nativeId: listed.nativeId }
      const sessionId = harnessSessionId(this.#context.database, session)
      if (sessionId !== undefined && this.#context.hasLiveChannel(sessionId)) continue
      this.#leaving.delete(harnessSessionKey(session))
      const tracked = this.#track(listed, previous?.get(listed.nativeId))
      current.set(listed.nativeId, tracked)
      if (sessionId === undefined) this.#discover(session, tracked)
      if (external.readActivity !== undefined) await this.#readChange(session, tracked)
      this.#show(session, tracked, Date.now())
    }
    for (const [nativeId, tracked] of previous ?? [])
      if (!current.has(nativeId))
        this.#leave({ harness, nativeId }, tracked, external.readActivity !== undefined)
    if (previous === undefined) this.#closeAll(harness, current)
  }

  // The same object across ticks, so a read that lands mid-tick is kept.
  #track(
    { transcript, status: listed }: LiveExternalSession,
    before: TrackedSession | undefined,
  ): TrackedSession {
    if (before === undefined)
      return {
        transcript,
        stamp: null,
        listed,
        status: null,
        changedAt: Date.now(),
        shown: null,
        retry: false,
        discovered: false,
      }
    before.listed = listed
    if (before.transcript !== transcript) {
      before.transcript = transcript
      before.stamp = null
      before.status = null
    }
    return before
  }

  // A transcript seen for the first time only records its stamp; a later change asks for a read,
  // as does a read that could not answer yet.
  async #readChange(session: HarnessSession, tracked: TrackedSession): Promise<void> {
    if (tracked.transcript === null) return
    const stamp = await stampOf(tracked.transcript)
    const before = tracked.stamp
    tracked.stamp = stamp
    const changed = stamp !== null && before !== null && !sameStamp(before, stamp)
    if (changed) {
      tracked.changedAt = Date.now()
      this.#update(session, { activityAt: tracked.changedAt })
    }
    if (!changed && !tracked.retry) return
    tracked.retry = false
    this.#read(session)
  }

  // A Session that left the list shows idle, until its last read settles a status where the
  // Harness reads activity.
  #leave(session: HarnessSession, tracked: TrackedSession, readsActivity: boolean): void {
    const sessionId = harnessSessionId(this.#context.database, session)
    if (sessionId !== undefined && this.#context.hasLiveChannel(sessionId)) return
    this.#update(session, { status: 'idle' })
    if (!readsActivity) return
    this.#leaving.set(harnessSessionKey(session), tracked)
    this.#read(session)
  }

  #discover(session: HarnessSession, tracked: TrackedSession): void {
    if (tracked.discovered) return
    tracked.discovered = true
    this.#context.discover(session)
  }

  #show(session: HarnessSession, tracked: TrackedSession, at: number): void {
    const status = shownStatus(tracked, at)
    if (status === null || status === tracked.shown) return
    tracked.shown = status
    this.#update(session, { status })
  }

  #update(session: HarnessSession, update: SessionUpdate): void {
    if (this.#stopped) return
    const key = harnessSessionKey(session)
    const pending = this.#pending.get(key)?.update
    const subagents = [...(pending?.subagents ?? []), ...(update.subagents ?? [])]
    this.#pending.set(key, { session, update: { ...pending, ...update, subagents } })
    this.#writeTimer ??= setTimeout(() => this.flush(), WRITE_WINDOW_MS)
  }

  // Asks for a read. A Session already queued is read once; one being read is read once more after.
  #read(session: HarnessSession): void {
    if (this.#stopped || !this.#asksForRead(harnessSessionKey(session))) return
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

  async #drain(): Promise<void> {
    if (this.#reading) return
    this.#reading = true
    try {
      for (let session = this.#queue.shift(); session !== undefined; session = this.#queue.shift())
        await this.#readOne(session)
    } finally {
      this.#reading = false
    }
  }

  async #readOne(session: HarnessSession): Promise<void> {
    const key = harnessSessionKey(session)
    this.#reads.set(key, 'reading')
    let reading: ExternalActivityReading | null = null
    try {
      const read = this.#external.get(session.harness)?.readActivity
      if (read === undefined) throw new Error('This Harness reads no external activity.')
      const tracked = this.#tracked(session) ?? this.#leaving.get(key)
      reading = await read(session.nativeId, tracked?.changedAt ?? Date.now())
    } catch (error) {
      // A failed read keeps the stored line.
      console.warn('Could not read an external Session activity:', error)
    }
    if (!this.#stopped) this.#receive(session, reading)
    const again = this.#reads.get(key) === 'again'
    this.#reads.delete(key)
    if (again) this.#read(session)
  }

  // The line is the newest Turn's activity by the Feed's own rules; none keeps the stored line.
  #receive(session: HarnessSession, reading: ExternalActivityReading | null): void {
    if (reading !== null) {
      const { activity } = projectFeedRowEntries({ history: reading.turn, live: [] })
      const subagents = reading.turn.filter((content) => content.kind === 'delegation')
      if (activity !== null || subagents.length > 0)
        this.#update(session, { ...(activity === null ? {} : { activity }), subagents })
    }
    const tracked = this.#tracked(session)
    if (tracked === undefined) {
      const left = this.#leaving.delete(harnessSessionKey(session))
      if (left && reading?.status != null && !reading.retry)
        this.#update(session, { status: reading.status })
      return
    }
    if (reading === null) return
    tracked.retry = reading.retry
    if (reading.status === null) return
    tracked.status = reading.status
    this.#show(session, tracked, Date.now())
  }

  #tracked(session: HarnessSession): TrackedSession | undefined {
    return this.#live.get(session.harness)?.get(session.nativeId)
  }

  // The first tick closes every Session an earlier run saved and it does not find live, in one
  // write. A live channel's own status outranks the stored one, so a Session Argo runs needs none.
  #closeAll(harness: Harness, live: ReadonlyMap<string, TrackedSession>): void {
    const conditions: SQL[] = [eq(sessionTable.harness, harness), ne(sessionTable.status, 'idle')]
    if (live.size > 0) conditions.push(notInArray(sessionTable.nativeId, [...live.keys()]))
    conditions.push(lte(sql`rowid`, this.#lastEarlierRow))
    const closed = this.#context.database
      .update(sessionTable)
      .set({ status: 'idle' })
      .where(and(...conditions))
      .returning({ id: sessionTable.argoId })
      .all()
    if (closed.length > 0) this.#context.changes.changed(closed.map(({ id }) => id))
  }
}
