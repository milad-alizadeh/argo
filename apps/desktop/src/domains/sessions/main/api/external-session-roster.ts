import { stat } from 'node:fs/promises'
import { and, eq, ne, notInArray, type SQL } from 'drizzle-orm'
import { sessionTable } from '@/database/session/schema'
import type { Harness } from '@/harnesses/harness'
import type {
  ExternalSessionStatus,
  ExternalSessions,
  LiveExternalSession,
} from '@/harnesses/registration'
import { type HarnessSession, SessionActivities } from './session-activities'
import { harnessSessionId, type SessionUpdateContext } from './session-update'

const EXTERNAL_POLL_MS = 2_000
// A killed terminal writes nothing more, so a running Session this quiet shows unknown (#87131).
export const RUNNING_QUIET_LIMIT_MS = 5 * 60_000

export type ExternalSessionRosterContext = SessionUpdateContext & {
  harnesses: readonly { harness: Harness; external: ExternalSessions }[]
  // Whether Argo runs a saved Session now; its live channel then owns its status and activity.
  hasLiveChannel: (sessionId: string) => boolean
  // A live external Session with no saved row.
  discover: (session: HarnessSession) => void
  writeMs?: number
}

type TrackedSession = {
  listed: ExternalSessionStatus
  transcript: string | null
  // The newest status the Harness's activity read settled; it outranks the listed one.
  settled: ExternalSessionStatus | null
  // When the transcript last grew, or when the Session was first seen live.
  grewAt: number
  // The status last queued; null queues it again on the next tick.
  shown: ExternalSessionStatus | null
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

// A running Session whose transcript has not grown for the quiet limit shows unknown.
function shownStatus(tracked: TrackedSession, at: number): ExternalSessionStatus {
  const status = tracked.settled ?? tracked.listed
  return status === 'running' && at - tracked.grewAt >= RUNNING_QUIET_LIMIT_MS ? 'unknown' : status
}

// The stored status and activity of Sessions that run outside Argo, from one poll. Each tick lists
// every Harness's live external Sessions, stats each transcript, asks a Harness that reads activity
// about each one that changed, and diffs the list against the last tick's. The first sight of a
// transcript only records its stamp, so startup reads nothing.
export class ExternalSessionRoster {
  readonly #context: ExternalSessionRosterContext
  readonly #activities: SessionActivities
  readonly #stamps = new Map<string, TranscriptStamp>()
  // Each Harness's live Sessions at its last tick; absent before its first.
  readonly #live = new Map<Harness, Map<string, TrackedSession>>()
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
        return read(session.nativeId)
      },
      read: (session, reading) => {
        const tracked = this.#live.get(session.harness)?.get(session.nativeId)
        if (tracked === undefined || reading.status === null) return
        tracked.settled = reading.status
        this.#show(session, tracked, Date.now())
      },
      unknown: (session) => this.#unknown(session),
      writeMs: context.writeMs,
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
      } catch (error) {
        console.warn('Could not poll external Sessions:', error)
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
    for (const listed of list.sessions) {
      const session = { harness, nativeId: listed.nativeId }
      if (this.#isLive(session)) continue
      const tracked = this.#track(listed, previous?.get(listed.nativeId))
      current.set(listed.nativeId, tracked)
      await this.#readGrowth(session, tracked, external.readActivity !== undefined)
      this.#show(session, tracked, Date.now())
    }
    for (const [nativeId, tracked] of previous ?? []) {
      if (current.has(nativeId)) continue
      if (tracked.transcript !== null) this.#stamps.delete(tracked.transcript)
      const session = { harness, nativeId }
      if (!this.#isLive(session)) this.#activities.update(session, { status: 'idle' })
    }
    if (previous === undefined) this.#closeAll(harness, current)
    this.#live.set(harness, current)
  }

  #track(listed: LiveExternalSession, before: TrackedSession | undefined): TrackedSession {
    const sameTranscript = before?.transcript === listed.transcript
    return {
      listed: listed.status,
      transcript: listed.transcript,
      settled: sameTranscript ? (before?.settled ?? null) : null,
      grewAt: before?.grewAt ?? Date.now(),
      shown: before?.shown ?? null,
      discovered: before?.discovered ?? false,
    }
  }

  // A transcript seen for the first time only records its stamp; a later change asks for a read.
  async #readGrowth(
    session: HarnessSession,
    tracked: TrackedSession,
    readsActivity: boolean,
  ): Promise<void> {
    if (tracked.transcript === null) return
    const stamp = await stampOf(tracked.transcript)
    const before = this.#stamps.get(tracked.transcript)
    if (stamp === null) {
      this.#stamps.delete(tracked.transcript)
      return
    }
    this.#stamps.set(tracked.transcript, stamp)
    if (before === undefined || sameStamp(before, stamp)) return
    tracked.grewAt = Date.now()
    this.#activities.update(session, { activityAt: tracked.grewAt })
    if (readsActivity) this.#activities.read(session)
  }

  #show(session: HarnessSession, tracked: TrackedSession, at: number): void {
    const status = shownStatus(tracked, at)
    if (status === tracked.shown) return
    tracked.shown = status
    this.#activities.update(session, { status })
  }

  // A live Session with no row is discovered once; its status is queued again for the new row.
  #unknown(session: HarnessSession): void {
    const tracked = this.#live.get(session.harness)?.get(session.nativeId)
    if (tracked === undefined) return
    tracked.shown = null
    if (tracked.discovered) return
    tracked.discovered = true
    this.#context.discover(session)
  }

  #isLive(session: HarnessSession): boolean {
    const sessionId = harnessSessionId(this.#context.database, session)
    return sessionId !== undefined && this.#context.hasLiveChannel(sessionId)
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
