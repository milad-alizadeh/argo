import { TRPCError } from '@trpc/server'
import type { Database } from '@/database/database'
import { type FeedReading, feedReading } from '@/domains/sessions/api/feed/feed-reading'
import { projectFeedRowEntries } from '@/domains/sessions/api/feed/feed-row-entries'
import {
  emptyLiveEventBuffer,
  type LiveEventBuffer,
  retainLiveEvent,
} from '@/domains/sessions/api/feed/live-event-buffer'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionError } from '@/domains/sessions/api/session-error'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import {
  SESSION_LIVE_REPLAY_BYTE_LIMIT,
  type SessionLiveEvent,
} from '@/domains/sessions/api/session-live-event'
import type { Harness } from '@/harnesses/harness'
import type { SessionActivities } from '../api/session-activities'
import { sessionHistoryIdentity } from '../api/session-history-identity'
import { observeSessionSync, type SessionSyncStatusStore } from '../api/session-sync-status'
import type { SessionEventJournal } from '../live/session-event-journal'
import type { SessionHistoryFollowers } from '../live/session-history-followers'

export type SessionFeedReaderContext = {
  database: Database
  journal: SessionEventJournal
  hasLiveChannel: (sessionId: string) => boolean
  readHistory: (harness: Harness, target: SessionHistoryTarget) => Promise<FeedContent[]>
  followHistory?: SessionHistoryFollowers['follow']
  sessionSyncStatus?: readonly SessionSyncStatusStore[]
  // Where each reading's current activity goes, so the roster draws the same line.
  activities?: Pick<SessionActivities, 'publish'>
}

type Observer = (reading: FeedReading) => void
type ReadState = FeedReading['state']

const encoder = new TextEncoder()

// Without a live channel, only what vendor history can also settle reaches the Feed.
export function canDeliver(event: SessionLiveEvent, live: boolean): boolean {
  if (live) return true
  switch (event.type) {
    case 'permission':
      return false
    case 'question':
      return event.answer !== null
    case 'content':
    case 'status':
    case 'failure':
      return true
  }
}

function readFailure(error: unknown): SessionError {
  const missing = error instanceof TRPCError && error.code === 'NOT_FOUND'
  return sessionError(missing ? 'missing-session' : 'vendor-history-unavailable', null)
}

// The newest Permission request whose latest event has no decision yet.
function pendingPermission(events: readonly SessionLiveEvent[]): string | null {
  const decided = new Map<string, boolean>()
  for (const event of events)
    if (event.type === 'permission') {
      decided.delete(event.requestId)
      decided.set(event.requestId, event.decision !== null)
    }
  return [...decided].findLast(([, isDecided]) => !isDecided)?.[0] ?? null
}

// One root Session's Feed: it attaches to live events before it reads vendor history, so an
// event that lands during the read is reconciled rather than missed.
class RootFeedReader {
  readonly #context: SessionFeedReaderContext
  readonly #sessionId: string
  readonly #observers = new Set<Observer>()
  readonly #stops: (() => void)[] = []
  #follower: { key: string; stop: () => void } | null = null
  #history: FeedContent[] = []
  #events: LiveEventBuffer = emptyLiveEventBuffer()
  #state: ReadState = 'loading'
  #error: SessionError | null = null
  #read = 0
  #stopped = false
  #reading: FeedReading | null = null

  constructor(context: SessionFeedReaderContext, sessionId: string) {
    this.#context = context
    this.#sessionId = sessionId
  }

  start(): void {
    const { journal, hasLiveChannel } = this.#context
    const replay = journal.replay(this.#sessionId, 0)
    const after = replay.cursor
    this.#stops.push(
      journal.subscribe(this.#sessionId, (event) => {
        if (event.sequence > after) this.#receive(event, hasLiveChannel(this.#sessionId))
      }),
    )
    // An expired replay lost events; the history read below is the fresh start.
    const live = hasLiveChannel(this.#sessionId)
    if (replay.type === 'events') for (const event of replay.events) this.#retain(event, live)
    // A committed sync can move where the Session's history lives.
    this.#stops.push(
      observeSessionSync(this.#context.sessionSyncStatus ?? [], (event) => {
        if (event.type === 'committed') this.refresh()
      }),
    )
    this.refresh()
  }

  observe(observer: Observer): () => void {
    this.#observers.add(observer)
    if (this.#reading !== null) observer(this.#reading)
    return () => this.#observers.delete(observer)
  }

  get observed(): boolean {
    return this.#observers.size > 0
  }

  // Every call starts a real read; a later read's answer replaces an earlier one's.
  refresh(): void {
    const read = ++this.#read
    this.#follow()
    if (this.#state !== 'ready') this.#settle('loading', this.#error)
    void this.#readHistory().then(
      (content) => {
        if (this.#stopped || read !== this.#read) return
        this.#history = content
        this.#settle('ready', null)
      },
      (error: unknown) => {
        if (this.#stopped || read !== this.#read) return
        this.#settle('failed', readFailure(error))
      },
    )
  }

  stop(): void {
    this.#stopped = true
    for (const stop of this.#stops.splice(0)) stop()
    this.#follower?.stop()
    this.#follower = null
    this.#observers.clear()
    // An unobserved Feed publishes nothing more, so its activity would only go stale.
    this.#context.activities?.publish(this.#sessionId, null)
  }

  async #readHistory(): Promise<FeedContent[]> {
    const stored = sessionHistoryIdentity(this.#context.database, this.#sessionId)
    return this.#context.readHistory(stored.harness, {
      nativeId: stored.nativeId,
      subagentId: null,
      cwd: stored.cwd,
    })
  }

  // A Session without a live channel follows its history file; each read re-checks both where
  // that file is and whether a live channel now carries the Session instead.
  #follow(): void {
    const { database, followHistory, hasLiveChannel } = this.#context
    if (followHistory === undefined) return
    let stored: ReturnType<typeof sessionHistoryIdentity> | null = null
    try {
      if (!hasLiveChannel(this.#sessionId))
        stored = sessionHistoryIdentity(database, this.#sessionId)
    } catch {
      stored = null
    }
    const key =
      stored === null ? null : JSON.stringify([stored.harness, stored.nativeId, stored.cwd])
    if (key === (this.#follower?.key ?? null)) return
    this.#follower?.stop()
    this.#follower = null
    if (stored === null || key === null) return
    const target = { nativeId: stored.nativeId, subagentId: null, cwd: stored.cwd }
    const stop = followHistory(
      { sessionId: this.#sessionId, harness: stored.harness, target },
      () => this.refresh(),
    )
    this.#follower = { key, stop }
  }

  #retain(event: SessionLiveEvent, live: boolean): void {
    if (canDeliver(event, live)) this.#events = retainLiveEvent(this.#events, event)
  }

  #receive(event: SessionLiveEvent, live: boolean): void {
    this.#retain(event, live)
    // A status change can mean a live channel opened or closed, which moves who follows history.
    if (event.type === 'status') this.#follow()
    const oversized =
      encoder.encode(JSON.stringify(event)).byteLength > SESSION_LIVE_REPLAY_BYTE_LIMIT
    // A settled Turn and an event too large to keep both live in vendor history now.
    if (oversized || (event.type === 'status' && event.status === 'idle')) this.refresh()
    this.#publish()
  }

  #settle(state: ReadState, error: SessionError | null): void {
    this.#state = state
    this.#error = error
    this.#publish()
  }

  #publish(): void {
    const { entries, activity, rejected } = projectFeedRowEntries({
      history: this.#history,
      live: this.#events.events,
    })
    const skipped = rejected.history + rejected.live + rejected.rows
    if (skipped > 0) console.warn(`Skipped ${skipped} unrecognised Session Feed item(s).`)
    const events = this.#events.events
    const status = events.findLast((event) => event.type === 'status')
    const reading = feedReading({
      sessionId: this.#sessionId,
      chainId: this.#sessionId,
      state: this.#state,
      error: this.#error,
      pendingPermissionId: pendingPermission(events),
      liveStatus: status?.type === 'status' ? status.status : null,
      entries,
    })
    if (reading.revision === this.#reading?.revision) return
    this.#reading = reading
    this.#context.activities?.publish(this.#sessionId, activity)
    for (const observer of this.#observers) observer(reading)
  }
}

// One reader per observed root Session, shared by every observer and stopped with the last.
export class SessionFeedReaders {
  readonly #context: SessionFeedReaderContext
  readonly #readers = new Map<string, RootFeedReader>()

  constructor(context: SessionFeedReaderContext) {
    this.#context = context
  }

  observe(sessionId: string, observer: Observer): () => void {
    let reader = this.#readers.get(sessionId)
    if (reader === undefined) {
      reader = new RootFeedReader(this.#context, sessionId)
      this.#readers.set(sessionId, reader)
      reader.start()
    }
    const current = reader
    const unobserve = current.observe(observer)
    return () => {
      unobserve()
      if (current.observed || this.#readers.get(sessionId) !== current) return
      this.#readers.delete(sessionId)
      current.stop()
    }
  }

  // Whether an observed Feed took the request; an unobserved one reads fresh when it opens.
  refresh(sessionId: string): boolean {
    const reader = this.#readers.get(sessionId)
    reader?.refresh()
    return reader !== undefined
  }
}
