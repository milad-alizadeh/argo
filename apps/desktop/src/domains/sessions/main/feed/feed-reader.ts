import { TRPCError } from '@trpc/server'
import type { Database } from '@/database/database'
import type { SessionFeedRow } from '@/domains/sessions/api/feed'
import {
  emptyLiveEventBuffer,
  type FeedChain,
  type FeedReading,
  FeedRowProjector,
  feedChainKey,
  feedEntryRows,
  feedReading,
  feedSubagents,
  type LiveEventBuffer,
  retainLiveEvent,
  subagentCompletionRows,
} from '@/domains/sessions/api/feed'
import {
  type FeedContent,
  feedContentSchema,
  type PlanProgress,
} from '@/domains/sessions/api/feed-content'
import type { SessionError } from '@/domains/sessions/api/session-error'
import { sessionError } from '@/domains/sessions/api/session-error'
import type { SessionHistoryTarget } from '@/domains/sessions/api/session-history'
import {
  SESSION_LIVE_REPLAY_BYTE_LIMIT,
  type SessionLiveEvent,
} from '@/domains/sessions/api/session-live-event'
import type { Harness } from '@/harnesses/harness'
import type { SessionListChanges } from '../api'
import { updateSession } from '../api'
import type { SessionEventJournal } from '../live'
import { sessionHistoryIdentity } from '../session-history-identity'

export type SessionFeedReaderContext = {
  database: Database
  journal: SessionEventJournal
  hasLiveChannel: (sessionId: string) => boolean
  // The signal takes a read still waiting for a slot back when its Feed closes.
  readHistory: (
    harness: Harness,
    target: SessionHistoryTarget,
    signal: AbortSignal,
  ) => Promise<FeedContent[]>
  // Carries each reading's activity to the Session List, and any write that moved the history.
  changes: SessionListChanges
}

type StoredHistory = ReturnType<typeof sessionHistoryIdentity>

type Observer = (reading: FeedReading) => void
type ReadState = FeedReading['state']

const encoder = new TextEncoder()

// Streamed text publishes at most once a window; any other event publishes at once.
export const FEED_TEXT_COALESCE_MS = 100

// Assistant text and reasoning arrive as snapshot after snapshot of the same row.
function isStreamedText(event: SessionLiveEvent): boolean {
  if (event.type !== 'content') return false
  const { content } = event
  return content.kind === 'reasoning' || (content.kind === 'message' && content.role !== 'user')
}

// A Plan's step count, when the Feed accepts the Plan.
function acceptedPlanProgress(content: FeedContent): PlanProgress | undefined {
  if (content.kind !== 'plan') return undefined
  const parsed = feedContentSchema.safeParse(content)
  return parsed.success && parsed.data.kind === 'plan' ? parsed.data.progress : undefined
}

// The newest accepted Plan's step count; a live event is newer than any history.
function newestPlanProgress(
  history: readonly FeedContent[],
  events: readonly SessionLiveEvent[],
): PlanProgress | null {
  const counted = (content: FeedContent) => acceptedPlanProgress(content) !== undefined
  const live = events.findLast((event) => event.type === 'content' && counted(event.content))
  const newest = live?.type === 'content' ? live.content : history.findLast(counted)
  return (newest && acceptedPlanProgress(newest)) ?? null
}

// Without a live channel, only what vendor history can also settle reaches the Feed.
function canDeliver(event: SessionLiveEvent, live: boolean): boolean {
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

function storedHistory(database: Database, sessionId: string): StoredHistory | null {
  try {
    return sessionHistoryIdentity(database, sessionId)
  } catch {
    return null
  }
}

const historyKey = (stored: StoredHistory | null) =>
  stored === null ? null : JSON.stringify([stored.harness, stored.nativeId, stored.cwd])

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

// A Subagent's Feed ends with the responses its parent's Feed recorded for it.
type ParentFeed = { observe: (observer: Observer) => () => void }

// One chain's Feed: a root Session attaches to live events before it reads vendor history, so an
// event that lands during the read is reconciled rather than missed. A Subagent has no live
// channel of its own; it reads again when its parent's record of it changes.
class FeedReader {
  readonly #context: SessionFeedReaderContext
  readonly #chain: FeedChain
  readonly #parent: ParentFeed | null
  readonly #observers = new Set<Observer>()
  readonly #stops: (() => void)[] = []
  // Where the last read found the history, so a write that moved nothing reads nothing again.
  #readKey: string | null = null
  #history: FeedContent[] = []
  #events: LiveEventBuffer = emptyLiveEventBuffer()
  #completion: SessionFeedRow[] = []
  #state: ReadState = 'loading'
  #error: SessionError | null = null
  #inFlight = false
  #followUp = false
  readonly #abort = new AbortController()
  #stopped = false
  #reading: FeedReading | null = null
  #textTimer: ReturnType<typeof setTimeout> | null = null
  readonly #projector = new FeedRowProjector()

  constructor(context: SessionFeedReaderContext, chain: FeedChain, parent: ParentFeed | null) {
    this.#context = context
    this.#chain = chain
    this.#parent = parent
  }

  start(): void {
    if (this.#parent === null) this.#attachLive()
    else this.#stops.push(this.#parent.observe((reading) => this.#receiveParent(reading)))
    const { database, changes } = this.#context
    const { sessionId } = this.#chain
    // A sync can move where the Session's history lives; this reader's own activity write cannot.
    this.#stops.push(
      changes.subscribe((sessionIds) => {
        if (
          sessionIds.includes(sessionId) &&
          historyKey(storedHistory(database, sessionId)) !== this.#readKey
        )
          this.refresh()
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

  // One read at a time; a call during it asks for one more read once it ends.
  refresh(): void {
    this.#readKey = historyKey(storedHistory(this.#context.database, this.#chain.sessionId))
    if (this.#inFlight) this.#followUp = true
    else this.#startRead()
  }

  #startRead(): void {
    this.#inFlight = true
    this.#followUp = false
    if (this.#state !== 'ready') this.#settle('loading', this.#error)
    void this.#readHistory().then(
      (content) =>
        this.#endRead(() => {
          this.#history = content
          this.#settle('ready', null)
        }),
      (error: unknown) => this.#endRead(() => this.#settle('failed', readFailure(error))),
    )
  }

  // A result that lands after the Feed closed is dropped.
  #endRead(settle: () => void): void {
    this.#inFlight = false
    if (this.#stopped) return
    settle()
    if (this.#followUp) this.#startRead()
  }

  stop(): void {
    this.#stopped = true
    this.#abort.abort()
    for (const stop of this.#stops.splice(0)) stop()
    this.#cancelText()
    this.#observers.clear()
  }

  #attachLive(): void {
    const { journal, hasLiveChannel } = this.#context
    const { sessionId } = this.#chain
    const replay = journal.replay(sessionId, 0)
    const after = replay.cursor
    this.#stops.push(
      journal.subscribe(sessionId, (event) => {
        if (event.sequence > after) this.#receive(event, hasLiveChannel(sessionId))
      }),
    )
    // An expired replay lost events; the history read that follows is the fresh start.
    const live = hasLiveChannel(sessionId)
    if (replay.type === 'events') for (const event of replay.events) this.#retain(event, live)
  }

  #target(stored: StoredHistory): SessionHistoryTarget {
    return { nativeId: stored.nativeId, subagentId: this.#chain.subagentId, cwd: stored.cwd }
  }

  async #readHistory(): Promise<FeedContent[]> {
    const stored = sessionHistoryIdentity(this.#context.database, this.#chain.sessionId)
    return this.#context.readHistory(stored.harness, this.#target(stored), this.#abort.signal)
  }

  #retain(event: SessionLiveEvent, live: boolean): void {
    if (canDeliver(event, live)) this.#events = retainLiveEvent(this.#events, event)
  }

  #receive(event: SessionLiveEvent, live: boolean): void {
    this.#retain(event, live)
    const oversized =
      encoder.encode(JSON.stringify(event)).byteLength > SESSION_LIVE_REPLAY_BYTE_LIMIT
    // A settled Turn and an event too large to keep both live in vendor history now.
    if (oversized || (event.type === 'status' && event.status === 'idle')) this.refresh()
    if (!isStreamedText(event)) this.#publish()
    else this.#textTimer ??= setTimeout(() => this.#publish(), FEED_TEXT_COALESCE_MS)
  }

  #cancelText(): void {
    if (this.#textTimer !== null) clearTimeout(this.#textTimer)
    this.#textTimer = null
  }

  // A new response from the parent means the Subagent's own transcript has settled too.
  #receiveParent(reading: FeedReading): void {
    const subagentId = this.#chain.subagentId
    if (subagentId === null) return
    const completion = subagentCompletionRows(feedEntryRows(reading.entries), subagentId)
    if (JSON.stringify(completion) === JSON.stringify(this.#completion)) return
    this.#completion = completion
    // A read still in flight already reads the settled transcript.
    if (this.#state === 'loading') this.#publish()
    else this.refresh()
  }

  #settle(state: ReadState, error: SessionError | null): void {
    this.#state = state
    this.#error = error
    this.#publish()
  }

  // Publishing reads every retained event, so text still waiting goes out with it.
  #publish(): void {
    this.#cancelText()
    const { entries, activity, rejected } = this.#projector.project({
      history: this.#history,
      live: this.#events.events,
      end: this.#completion,
    })
    const skipped = rejected.history + rejected.live + rejected.rows
    if (skipped > 0) console.warn(`Skipped ${skipped} unrecognised Session Feed item(s).`)
    const events = this.#events.events
    const status = events.findLast((event) => event.type === 'status')
    const { sessionId, subagentId } = this.#chain
    const rows = feedEntryRows(entries)
    const reading = feedReading({
      sessionId,
      chainId: subagentId ?? sessionId,
      state: this.#state,
      error: this.#error,
      pendingPermissionId: pendingPermission(events),
      liveStatus: status?.type === 'status' ? status.status : null,
      entries,
      subagents: subagentId === null ? feedSubagents(rows) : [],
    })
    if (reading.revision === this.#reading?.revision) return
    this.#reading = reading
    // Keeps the activity and Plan progress for the Session List after this reader closes. A
    // reading with no Plan keeps the stored count, since a vendor history may hold none.
    const planProgress = newestPlanProgress(this.#history, events)
    if (subagentId === null)
      updateSession(this.#context, sessionId, {
        activity,
        ...(planProgress === null ? {} : { planProgress }),
      })
    for (const observer of this.#observers) observer(reading)
  }
}

// One reader per observed chain, shared by every observer and stopped with the last. A Subagent's
// reader observes its parent's, so the parent reads as long as either is open.
export class SessionFeedReaders {
  readonly #context: SessionFeedReaderContext
  readonly #readers = new Map<string, FeedReader>()

  constructor(context: SessionFeedReaderContext) {
    this.#context = context
  }

  observe(chain: FeedChain, observer: Observer): () => void {
    const key = feedChainKey(chain)
    let reader = this.#readers.get(key)
    if (reader === undefined) {
      const parent: ParentFeed | null =
        chain.subagentId === null
          ? null
          : {
              observe: (parentObserver) =>
                this.observe({ sessionId: chain.sessionId, subagentId: null }, parentObserver),
            }
      reader = new FeedReader(this.#context, chain, parent)
      this.#readers.set(key, reader)
      reader.start()
    }
    const current = reader
    const unobserve = current.observe(observer)
    return () => {
      unobserve()
      if (current.observed || this.#readers.get(key) !== current) return
      this.#readers.delete(key)
      current.stop()
    }
  }

  // Whether an observed Feed took the request; an unobserved one reads fresh when it opens.
  refresh(chain: FeedChain): boolean {
    const reader = this.#readers.get(feedChainKey(chain))
    reader?.refresh()
    return reader !== undefined
  }
}
