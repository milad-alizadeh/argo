import { stat } from 'node:fs/promises'
import { and, eq, gt, inArray, lte, ne, notInArray, type SQL, sql } from 'drizzle-orm'
import { sessionTable } from '@/database/session/schema'
import { projectFeedRowEntries } from '@/domains/sessions/api/feed'
import { type Harness, type HarnessSession, harnessSessionKey } from '@/harnesses/harness'
import type { ExternalHookReading } from '@/harnesses/host/status-hooks'
import type {
  ExternalActivityReading,
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
} from '@/harnesses/registration'
import { isIdentifier } from '@/shared/validation'
import { saveDiscoveredSessionSubagents, saveSessionSubagents } from '../database'
import {
  harnessSessionId,
  type SessionUpdate,
  type SessionUpdateContext,
  updateHarnessSession,
} from './session-update'

const EXTERNAL_POLL_MS = 2_000
const SUBAGENT_LOOKUP_MS = 30_000
// A killed terminal writes nothing more, so a settled running or permission status this quiet
// shows unknown; an approval dismissed with Esc sends no hook event either.
export const RUNNING_QUIET_LIMIT_MS = 5 * 60_000
const GOES_QUIET: Record<ExternalSessionStatus, boolean> = {
  running: true,
  permission: true,
  asking: false,
  idle: false,
  unknown: false,
}
// Each Session's row reaches SQLite at most once a window, with its newest values.
const WRITE_WINDOW_MS = 500

export type ExternalSessionPollContext = SessionUpdateContext & {
  harnesses: readonly { harness: Harness; external: ExternalSessions }[]
  // Whether Argo runs a saved Session now; its live channel then owns its status and activity.
  hasLiveChannel: (sessionId: string) => boolean
  // A live external Session with no saved row.
  discover: (session: HarnessSession) => void
  // Reads an open Feed again; a closed one reads nothing.
  refreshFeed: (sessionId: string) => void
}

// What a transcript stat compares between ticks; Argo reads none of the file's content.
type TranscriptStamp = { inode: number; size: number; modifiedMs: number }

type TrackedSession = {
  transcript: string | null
  // The transcript's last stat; null until the first one.
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
  subagentsFailed: boolean
  subagentsRejected: number
  subagentsCheckedAt: number | null
  subagentsCwd: string | null
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

// A settled status outranks the listed one, and shows unknown once nothing has changed for the
// quiet limit; a listed status is fresh from every tick.
function shownStatus(tracked: TrackedSession, at: number): ExternalSessionStatus | null {
  const { status } = tracked
  if (status === null) return tracked.listed
  return GOES_QUIET[status] && at - tracked.changedAt >= RUNNING_QUIET_LIMIT_MS ? 'unknown' : status
}

const newTracked = (
  transcript: string | null,
  listed: ExternalSessionStatus | null,
): TrackedSession => ({
  transcript,
  stamp: null,
  listed,
  status: null,
  changedAt: Date.now(),
  shown: null,
  retry: false,
  discovered: false,
  subagentsFailed: false,
  subagentsRejected: 0,
  subagentsCheckedAt: null,
  subagentsCwd: null,
})

// The stored status and activity of Sessions that run outside Argo, from one poll. Each tick lists
// every Harness's live external Sessions, stats each transcript, asks the Harness about each one
// that changed or left, and diffs the list against the last tick's. The first sight of a transcript
// reads only when nothing gives a status yet. Updates merge into one write per Session a window,
// and activity reads run one at a time, since one vendor read can take a large file whole.
export class ExternalSessionPoll {
  readonly #context: ExternalSessionPollContext
  readonly #external: ReadonlyMap<Harness, ExternalSessions>
  // Each Harness's newest row its listings have checked; an upsert keeps a row's rowid, and a new
  // row gets a higher one.
  // The watermark assumes rowids are never reused or renumbered.
  readonly #checkedThrough = new Map<Harness, number>()
  // Each Harness's live Sessions at its last tick; absent before its first.
  readonly #live = new Map<Harness, Map<string, TrackedSession>>()
  // Sessions hooked before their Harness's first listing, which that listing takes over.
  readonly #beforeListing = new Map<Harness, Map<string, TrackedSession>>()
  // Sessions that left the list and wait for their last read, by Harness and native ID.
  readonly #leaving = new Map<string, TrackedSession>()
  // Harnesses whose last listing failed, so a failure is reported once until one succeeds.
  readonly #failing = new Set<Harness>()
  // Each Harness's last reported count of unrecognised live records, so a count is reported once.
  readonly #rejected = new Map<Harness, number>()
  // Sessions a status hook fired for, even before the first listing; a tick reads no Feed for them.
  readonly #hooked = new Set<string>()
  readonly #pending = new Map<string, { session: HarnessSession; update: SessionUpdate }>()
  readonly #reads = new Map<string, ReadState>()
  readonly #queue: HarnessSession[] = []
  // The read queue's drain, while one runs.
  #draining: Promise<void> | null = null
  #writeTimer: ReturnType<typeof setTimeout> | null = null
  #ticking: Promise<void> | null = null
  #interval: ReturnType<typeof setInterval> | null = null
  #stopped = false

  constructor(context: ExternalSessionPollContext) {
    this.#context = context
    this.#external = new Map(context.harnesses.map(({ harness, external }) => [harness, external]))
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

  // Settles once every read asked for so far has landed, for a test that waits on them.
  readsSettled(): Promise<void> {
    return this.#draining ?? Promise.resolve()
  }

  stop(): void {
    this.flush()
    this.#stopped = true
    if (this.#interval !== null) clearInterval(this.#interval)
    this.#queue.length = 0
    this.#reads.clear()
  }

  // One status hook event; Argo's own Sessions are left to their live channel.
  hookEvent(harness: Harness, reading: ExternalHookReading): void {
    if (this.#stopped) return
    const { event } = reading
    const session = { harness, nativeId: reading.nativeId }
    const sessionId = harnessSessionId(this.#context.database, session)
    if (sessionId === undefined) {
      if (event === 'SessionStart') this.#context.discover(session)
      return
    }
    if (this.#context.hasLiveChannel(sessionId)) return
    this.#hooked.add(harnessSessionKey(session))
    // Before the first listing a hook is held aside, so that listing still closes stale rows.
    const live = this.#live.get(harness) ?? this.#hookedBeforeListing(harness)
    const tracked = live.get(session.nativeId) ?? newTracked(null, null)
    live.set(session.nativeId, tracked)
    tracked.changedAt = Date.now()
    if (reading.status !== null) tracked.status = reading.status
    this.#update(session, {
      activityAt: tracked.changedAt,
      ...(reading.activity === null ? {} : { activity: reading.activity }),
    })
    this.#show(session, tracked, tracked.changedAt)
    if (event === 'SessionEnd') live.delete(session.nativeId)
  }

  #hookedBeforeListing(harness: Harness): Map<string, TrackedSession> {
    const hooked = this.#beforeListing.get(harness) ?? new Map<string, TrackedSession>()
    this.#beforeListing.set(harness, hooked)
    return hooked
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
    // A row saved after the listing may be a Session it missed, so the next listing closes it.
    const newestRow = this.#newestRow()
    const list = await external.listLive()
    if (this.#stopped) return
    this.#reportRejected(harness, list.rejected)
    const previous = this.#live.get(harness)
    const known = previous ?? this.#beforeListing.get(harness)
    this.#beforeListing.delete(harness)
    const current = new Map<string, TrackedSession>()
    this.#live.set(harness, current)
    for (const listed of list.sessions) {
      const session = { harness, nativeId: listed.nativeId }
      const sessionId = harnessSessionId(this.#context.database, session)
      if (sessionId !== undefined && this.#context.hasLiveChannel(sessionId)) continue
      this.#leaving.delete(harnessSessionKey(session))
      const tracked = this.#carry(listed, known?.get(listed.nativeId), current.get(listed.nativeId))
      current.set(listed.nativeId, tracked)
      if (sessionId === undefined) this.#discover(session, tracked)
      if (external.readActivity !== undefined) await this.#readChange(session, tracked)
      await this.#indexSubagents(session, sessionId, tracked)
      this.#show(session, tracked, Date.now())
      this.#refreshUnstamped(session, sessionId, tracked)
    }
    for (const [nativeId, tracked] of previous ?? [])
      if (!current.has(nativeId))
        this.#leave({ harness, nativeId }, tracked, external.readActivity !== undefined)
    this.#closeSaved(harness, current, newestRow)
  }

  async #indexSubagents(
    session: HarnessSession,
    sessionId: string | undefined,
    tracked: TrackedSession,
  ): Promise<void> {
    const listSubagents = this.#external.get(session.harness)?.listSubagents
    if (sessionId === undefined || listSubagents === undefined) return
    const cwd =
      this.#context.database
        .select({ cwd: sessionTable.cwd })
        .from(sessionTable)
        .where(eq(sessionTable.argoId, sessionId))
        .get()?.cwd ?? null
    const now = Date.now()
    if (
      tracked.subagentsCheckedAt !== null &&
      tracked.subagentsCwd === cwd &&
      now - tracked.subagentsCheckedAt < SUBAGENT_LOOKUP_MS
    )
      return
    tracked.subagentsCheckedAt = now
    tracked.subagentsCwd = cwd
    try {
      const ids: unknown = await listSubagents(session.nativeId, cwd)
      if (!Array.isArray(ids)) throw new Error('The vendor returned no Subagent ID list.')
      const valid = ids.filter(isIdentifier)
      const rejected = ids.length - valid.length
      if (rejected > 0 && rejected !== tracked.subagentsRejected)
        console.warn(`Rejected ${rejected} unrecognised ${session.harness} Subagent ID(s).`)
      tracked.subagentsRejected = rejected
      tracked.subagentsFailed = false
      if (
        saveDiscoveredSessionSubagents(
          this.#context.database,
          session.harness,
          [...new Set(valid)].map((nativeId) => ({ nativeId, parentSessionId: sessionId })),
        ).length > 0
      )
        this.#context.changes.changed([sessionId])
    } catch (error) {
      if (!tracked.subagentsFailed)
        console.warn(`Could not list ${session.harness} Subagents for ${session.nativeId}:`, error)
      tracked.subagentsFailed = true
    }
  }

  // No transcript means no activity write, so an open Feed with no hook yet reads each tick.
  #refreshUnstamped(
    session: HarnessSession,
    sessionId: string | undefined,
    tracked: TrackedSession,
  ): void {
    if (sessionId === undefined || tracked.transcript !== null) return
    if (!this.#hooked.has(harnessSessionKey(session))) this.#context.refreshFeed(sessionId)
  }

  #reportRejected(harness: Harness, rejected: number): void {
    if (rejected > 0 && rejected !== this.#rejected.get(harness))
      console.warn(`Rejected ${rejected} unrecognised ${harness} live Session record(s).`)
    this.#rejected.set(harness, rejected)
  }

  // A hook that landed during this tick made its own record, whose newer fields win.
  #carry(
    listed: LiveExternalSession,
    before: TrackedSession | undefined,
    hooked: TrackedSession | undefined,
  ): TrackedSession {
    const tracked = this.#track(listed, before ?? hooked)
    if (hooked === undefined || hooked === tracked) return tracked
    tracked.status = hooked.status ?? tracked.status
    tracked.changedAt = hooked.changedAt
    tracked.shown = hooked.shown
    return tracked
  }

  // The same object across ticks, so a read that lands mid-tick is kept. A late transcript keeps a
  // hook's status.
  #track(
    { transcript, status: listed }: LiveExternalSession,
    before: TrackedSession | undefined,
  ): TrackedSession {
    if (before === undefined) return newTracked(transcript, listed)
    before.listed = listed
    if (before.transcript !== transcript) {
      before.transcript = transcript
      before.stamp = null
    }
    return before
  }

  // A first transcript read can establish status or find Codex children.
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
    const firstWithoutStatus =
      stamp !== null && before === null && shownStatus(tracked, Date.now()) === null
    if (!changed && !tracked.retry && !firstWithoutStatus) return
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
    this.#pending.set(key, { session, update: { ...pending, ...update } })
    this.#writeTimer ??= setTimeout(() => this.flush(), WRITE_WINDOW_MS)
  }

  // Asks for a read. A Session already queued is read once; one being read is read once more after.
  #read(session: HarnessSession): void {
    if (this.#stopped || !this.#asksForRead(harnessSessionKey(session))) return
    this.#queue.push(session)
    this.#draining ??= this.#drain()
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

  // Clears itself in the same turn the queue empties, so a later ask starts a new drain.
  async #drain(): Promise<void> {
    try {
      for (let session = this.#queue.shift(); session !== undefined; session = this.#queue.shift())
        await this.#readOne(session)
    } finally {
      this.#draining = null
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
      if (activity !== null) this.#update(session, { activity })
      const sessionId = harnessSessionId(this.#context.database, session)
      if (
        sessionId !== undefined &&
        saveSessionSubagents(this.#context.database, sessionId, reading.turn) > 0
      )
        this.#context.changes.changed([sessionId])
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

  #newestRow(): number {
    return (
      this.#context.database
        .select({ rowid: sql<number | null>`max(rowid)` })
        .from(sessionTable)
        .get()?.rowid ?? 0
    )
  }

  // Each listing closes, once, every row saved before it and since the last that it does not find
  // live (#3168); a Session Argo runs is skipped, since its live channel owns its status.
  #closeSaved(
    harness: Harness,
    live: ReadonlyMap<string, TrackedSession>,
    newestRow: number,
  ): void {
    const checkedRow = this.#checkedThrough.get(harness) ?? 0
    if (newestRow <= checkedRow) return
    this.#checkedThrough.set(harness, newestRow)
    const conditions: SQL[] = [
      eq(sessionTable.harness, harness),
      ne(sessionTable.status, 'idle'),
      gt(sql`rowid`, checkedRow),
      lte(sql`rowid`, newestRow),
    ]
    if (live.size > 0) conditions.push(notInArray(sessionTable.nativeId, [...live.keys()]))
    const toClose = this.#context.database
      .select({ id: sessionTable.argoId })
      .from(sessionTable)
      .where(and(...conditions))
      .all()
      .map(({ id }) => id)
      .filter((id) => !this.#context.hasLiveChannel(id))
    if (toClose.length === 0) return
    this.#context.database
      .update(sessionTable)
      .set({ status: 'idle' })
      .where(inArray(sessionTable.argoId, toClose))
      .run()
    this.#context.changes.changed(toClose)
  }
}
