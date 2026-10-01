import { stat } from 'node:fs/promises'
import { and, eq, ne, notInArray, type SQL } from 'drizzle-orm'
import { sessionTable } from '@/database/session/schema'
import type { Harness } from '@/harnesses/harness'
import type {
  ExternalActivityReading,
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
} from '@/harnesses/registration'
import { type HarnessSession, SessionActivities, sessionKey } from './session-activities'
import { harnessSessionId, type SessionUpdateContext } from './session-update'

const EXTERNAL_POLL_MS = 2_000
// A killed terminal writes nothing more, so a read-settled running status this quiet shows unknown.
export const RUNNING_QUIET_LIMIT_MS = 5 * 60_000

export type ExternalSessionRosterContext = SessionUpdateContext & {
  harnesses: readonly { harness: Harness; external: ExternalSessions }[]
  // Whether Argo runs a saved Session now; its live channel then owns its status and activity.
  hasLiveChannel: (sessionId: string) => boolean
  // A live external Session with no saved row.
  discover: (session: HarnessSession) => void
}

type TrackedSession = {
  transcript: string | null
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

// What a transcript stat compares between ticks; Argo reads none of the file's content.
type TranscriptStamp = { inode: number; size: number; modifiedMs: number }

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
// only records its stamp, so startup reads nothing.
export class ExternalSessionRoster {
  readonly #context: ExternalSessionRosterContext
  readonly #activities: SessionActivities
  readonly #stamps = new Map<string, TranscriptStamp>()
  // Each Harness's live Sessions at its last tick; absent before its first.
  readonly #live = new Map<Harness, Map<string, TrackedSession>>()
  // Sessions that left the list and wait for their last read, by Harness and native ID.
  readonly #leaving = new Map<string, TrackedSession>()
  // Harnesses whose last listing failed, so a failure is reported once until one succeeds.
  readonly #failing = new Set<Harness>()
  #ticking: Promise<void> | null = null
  #interval: ReturnType<typeof setInterval> | null = null
  #stopped = false

  constructor(context: ExternalSessionRosterContext) {
    this.#context = context
    const external = new Map(context.harnesses.map(({ harness, external }) => [harness, external]))
    this.#activities = new SessionActivities(context, {
      readActivity: (session) => {
        const read = external.get(session.harness)?.readActivity
        if (read === undefined) throw new Error('This Harness reads no external activity.')
        const tracked = this.#tracked(session) ?? this.#leaving.get(sessionKey(session))
        return read(session.nativeId, tracked?.changedAt ?? Date.now())
      },
      read: (session, reading) => this.#read(session, reading),
      unknown: (session) => this.#unknown(session),
    })
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
    this.#activities.flush()
  }

  stop(): void {
    this.#stopped = true
    if (this.#interval !== null) clearInterval(this.#interval)
    this.#activities.stop()
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
      this.#leaving.delete(sessionKey(session))
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
      before.status = null
    }
    return before
  }

  // A transcript seen for the first time only records its stamp; a later change asks for a read,
  // as does a read that could not answer yet.
  async #readChange(session: HarnessSession, tracked: TrackedSession): Promise<void> {
    if (tracked.transcript === null) return
    const stamp = await stampOf(tracked.transcript)
    const before = this.#stamps.get(tracked.transcript)
    if (stamp === null) this.#stamps.delete(tracked.transcript)
    else this.#stamps.set(tracked.transcript, stamp)
    const changed = stamp !== null && before !== undefined && !sameStamp(before, stamp)
    if (changed) {
      tracked.changedAt = Date.now()
      this.#activities.update(session, { activityAt: tracked.changedAt })
    }
    if (!changed && !tracked.retry) return
    tracked.retry = false
    this.#activities.read(session)
  }

  // A Session that left the list shows idle, until its last read settles a status where the
  // Harness reads activity.
  #leave(session: HarnessSession, tracked: TrackedSession, readsActivity: boolean): void {
    if (tracked.transcript !== null) this.#stamps.delete(tracked.transcript)
    const sessionId = harnessSessionId(this.#context.database, session)
    if (sessionId !== undefined && this.#context.hasLiveChannel(sessionId)) return
    this.#activities.update(session, { status: 'idle' })
    if (!readsActivity) return
    this.#leaving.set(sessionKey(session), tracked)
    this.#activities.read(session)
  }

  #read(session: HarnessSession, reading: ExternalActivityReading | null): void {
    const tracked = this.#tracked(session)
    if (tracked === undefined) {
      const left = this.#leaving.delete(sessionKey(session))
      if (left && reading?.status != null && !reading.retry)
        this.#activities.update(session, { status: reading.status })
      return
    }
    if (reading === null) return
    tracked.retry = reading.retry
    if (reading.status === null) return
    tracked.status = reading.status
    this.#show(session, tracked, Date.now())
  }

  #show(session: HarnessSession, tracked: TrackedSession, at: number): void {
    const status = shownStatus(tracked, at)
    if (status === null || status === tracked.shown) return
    tracked.shown = status
    this.#activities.update(session, { status })
  }

  #discover(session: HarnessSession, tracked: TrackedSession): void {
    if (tracked.discovered) return
    tracked.discovered = true
    this.#context.discover(session)
  }

  // A write for a Session with no row yet discovers it, and queues its status again for the row.
  #unknown(session: HarnessSession): void {
    const tracked = this.#tracked(session)
    if (tracked === undefined) return
    tracked.shown = null
    this.#discover(session, tracked)
  }

  #tracked(session: HarnessSession): TrackedSession | undefined {
    return this.#live.get(session.harness)?.get(session.nativeId)
  }

  // The first tick closes every saved Session it does not find live, in one write. A live
  // channel's own status outranks the stored one, so a Session Argo runs needs no exception.
  #closeAll(harness: Harness, live: ReadonlyMap<string, TrackedSession>): void {
    const conditions: SQL[] = [eq(sessionTable.harness, harness), ne(sessionTable.status, 'idle')]
    if (live.size > 0) conditions.push(notInArray(sessionTable.nativeId, [...live.keys()]))
    const closed = this.#context.database
      .update(sessionTable)
      .set({ status: 'idle' })
      .where(and(...conditions))
      .returning({ id: sessionTable.argoId })
      .all()
    if (closed.length > 0) this.#context.changes.changed(closed.map(({ id }) => id))
  }
}
