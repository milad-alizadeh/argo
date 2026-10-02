import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import type { SessionFeedRow } from '@/domains/sessions/api/feed'
import {
  emptyLiveEventBuffer,
  FEED_PAGE_ROWS,
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
import {
  MAX_HISTORY_EXTENT,
  type SessionHistoryTail,
  type SessionHistoryTarget,
} from '@/domains/sessions/api/session-history'
import {
  SESSION_LIVE_REPLAY_BYTE_LIMIT,
  type SessionLiveEvent,
} from '@/domains/sessions/api/session-live-event'
import type { Harness } from '@/harnesses/harness'
import type { SessionListChanges } from '../api'
import { updateSession } from '../api'
import { saveSessionSubagentFacts } from '../database'
import type { SessionEventJournal } from '../live'
import { sessionHistoryIdentity } from '../session-history-identity'
import { pendingFeedReading } from './pending-feed-reading'

export type SessionFeedReaderContext = {
  database: Database
  journal: SessionEventJournal
  hasLiveChannel: (sessionId: string) => boolean
  // The signal takes a read still waiting for a slot back when its Feed closes.
  readHistory: (
    harness: Harness,
    target: SessionHistoryTarget,
    read: { signal: AbortSignal; extent: number },
  ) => Promise<SessionHistoryTail>
  // Carries each reading's activity to the Session List, and any write that moved the history.
  changes: SessionListChanges
}

type StoredHistory = ReturnType<typeof sessionHistoryIdentity>

type FeedEntry = FeedReading['entries'][number]
// Each published reading, and every row loaded for it, inside the page the reading carries or not.
type Observer = (reading: FeedReading, loaded: readonly FeedEntry[]) => void
type ReadState = FeedReading['state']

const encoder = new TextEncoder()

// Streamed text publishes at most once a window; any other event publishes at once.
export const FEED_TEXT_COALESCE_MS = 100
const SUBAGENT_FEED_REFRESH_MS = 2_000

// A tail cut off by the read starts with the first Turn wholly inside it, so its rows never change
// when a wider read adds the rest of that Turn.
function fromFirstTurn(content: FeedContent[]): FeedContent[] {
  const first = content.findIndex((item) => item.kind === 'message' && item.role === 'user')
  return first === -1 ? [] : content.slice(first)
}

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

// Where a published page starts: the row it starts at and how many rows before it the reader wants;
// a null anchor stands after the newest row.
type FeedPage = { anchor: string | null; owed: number }
const NEWEST_PAGE: FeedPage = { anchor: null, owed: FEED_PAGE_ROWS }

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
  // How wide the last history read was, and whether it reached the Session's first message.
  #extent = 0
  #complete = true
  // The first row of the page published, and how many rows the reader wants before it.
  readonly #opened: FeedPage
  #anchor: string | null
  #owed: number
  #loaded: FeedEntry[] = []
  #events: LiveEventBuffer = emptyLiveEventBuffer()
  #completion: SessionFeedRow[] = []
  #state: ReadState = 'loading'
  #error: SessionError | null = null
  #inFlight = false
  #followUp = false
  readonly #abort = new AbortController()
  #stopped = false
  #reading: FeedReading | null = null
  #indexedSubagents: string | null = null
  #textTimer: ReturnType<typeof setTimeout> | null = null
  #subagentRefresh: ReturnType<typeof setInterval> | null = null
  readonly #projector = new FeedRowProjector()

  constructor(
    context: SessionFeedReaderContext,
    chain: FeedChain,
    { parent, page }: { parent: ParentFeed | null; page: FeedPage },
  ) {
    this.#context = context
    this.#chain = chain
    this.#parent = parent
    this.#opened = page
    this.#anchor = page.anchor
    this.#owed = page.owed
  }

  // The page last published, so the chain's next reader opens on the rows the renderer drew.
  get page(): FeedPage {
    const reading = this.#reading
    if (reading?.state !== 'ready') return this.#opened
    const first = reading.entries[0]
    if (!reading.hasOlder) return { anchor: null, owed: Number.POSITIVE_INFINITY }
    return first === undefined ? NEWEST_PAGE : { anchor: first.id, owed: 0 }
  }

  start(): void {
    if (this.#parent === null) this.#attachLive()
    else {
      this.#subagentRefresh = setInterval(() => this.refresh(), SUBAGENT_FEED_REFRESH_MS)
      this.#stops.push(
        this.#parent.observe((reading, loaded) => this.#receiveParent(reading, loaded)),
      )
    }
    const { sessionId } = this.#chain
    // This reader's own activity write moves nothing in the key.
    this.#stops.push(
      this.#context.changes.subscribe((sessionIds) => {
        if (sessionIds.includes(sessionId) && this.#key() !== this.#readKey) this.refresh()
      }),
    )
    this.refresh()
  }

  observe(observer: Observer): () => void {
    this.#observers.add(observer)
    if (this.#reading !== null) observer(this.#reading, this.#loaded)
    return () => this.#observers.delete(observer)
  }

  get observed(): boolean {
    return this.#observers.size > 0
  }

  // One read at a time; a call during it asks for one more read once it ends.
  refresh(): void {
    this.#readKey = this.#key()
    if (this.#inFlight) this.#followUp = true
    else this.#startRead()
  }

  // Puts the page before the published one into the Feed, reading further back when the rows
  // loaded run out. False when the Feed already starts at the Session's first row.
  loadOlder(): boolean {
    if (this.#reading?.hasOlder !== true) return false
    this.#anchor = this.#reading.entries[0]?.id ?? null
    this.#owed = FEED_PAGE_ROWS
    if (this.#covers(this.#loaded)) this.#publish()
    else this.refresh()
    return true
  }

  // Where the published page starts in `entries`; an anchor gone from them falls back to the
  // newest page.
  #pageStart(entries: readonly FeedEntry[]): number {
    const anchored =
      this.#anchor === null ? entries.length : entries.findIndex(({ id }) => id === this.#anchor)
    if (anchored === -1) return Math.max(0, entries.length - FEED_PAGE_ROWS)
    return Math.max(0, anchored - this.#owed)
  }

  // Whether `entries` hold every row the published page wants; a cut-off read that lost the
  // anchor reads further back for it.
  #covers(entries: readonly FeedEntry[]): boolean {
    if (this.#complete) return true
    const anchored =
      this.#anchor === null ? entries.length : entries.findIndex(({ id }) => id === this.#anchor)
    return anchored >= this.#owed
  }

  // Where the history lives; with no live channel, also the row's activity and status, which a hook
  // event or the poll moves.
  #key(): string | null {
    const { database, hasLiveChannel } = this.#context
    const { sessionId } = this.#chain
    const stored = historyKey(storedHistory(database, sessionId))
    if (stored === null || hasLiveChannel(sessionId)) return stored
    const row = database
      .select({ activityAt: sessionTable.activityAt, status: sessionTable.status })
      .from(sessionTable)
      .where(eq(sessionTable.argoId, sessionId))
      .get()
    return JSON.stringify([stored, row?.activityAt, row?.status])
  }

  #startRead(): void {
    this.#inFlight = true
    this.#followUp = false
    if (this.#state !== 'ready') this.#settle('loading', this.#error)
    void this.#readHistory().then(
      ({ content, complete }) =>
        this.#endRead(() => {
          this.#history = content
          this.#complete = complete
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
    if (this.#subagentRefresh !== null) clearInterval(this.#subagentRefresh)
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

  // The narrowest read that holds the page the Feed wants, widened one step at a time.
  async #readHistory(): Promise<SessionHistoryTail> {
    const stored = sessionHistoryIdentity(this.#context.database, this.#chain.sessionId)
    const target = this.#target(stored)
    for (; this.#extent < MAX_HISTORY_EXTENT; this.#extent += 1) {
      const read = await this.#context.readHistory(stored.harness, target, {
        signal: this.#abort.signal,
        extent: this.#extent,
      })
      if (read.complete) return read
      const content = fromFirstTurn(read.content)
      const { entries } = this.#projector.project({
        history: content,
        live: this.#events.events,
        end: this.#completion,
      })
      this.#complete = false
      if (this.#stopped || this.#covers(entries)) return { content, complete: false }
    }
    throw new Error(`The history of Session ${this.#chain.sessionId} never read complete.`)
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
  #receiveParent(reading: FeedReading, loaded: readonly FeedEntry[]): void {
    const subagentId = this.#chain.subagentId
    if (subagentId === null) return
    const subagent = reading.subagents.find(({ id }) => id === subagentId)
    const finished =
      subagent?.state === 'completed' ||
      subagent?.state === 'failed' ||
      subagent?.state === 'interrupted'
    // A Subagent still running was delegated in the parent's newest rows; one missing from a cut
    // parent is old.
    const old = subagent === undefined && reading.hasOlder
    if ((finished || old) && this.#subagentRefresh !== null) {
      clearInterval(this.#subagentRefresh)
      this.#subagentRefresh = null
    }
    const completion = subagentCompletionRows(feedEntryRows(loaded), subagentId)
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

  #indexSubagents(sessionId: string, subagents: ReturnType<typeof feedSubagents>) {
    const indexKey = JSON.stringify(subagents.map(({ id, label, state }) => [id, label, state]))
    if (indexKey === this.#indexedSubagents) return
    if (saveSessionSubagentFacts(this.#context.database, sessionId, subagents) > 0)
      this.#context.changes.changed([sessionId])
    this.#indexedSubagents = indexKey
  }

  // A read that holds the rows the page wanted fixes the row the page starts at; a page that starts
  // at the Session's first row keeps every row a later read puts before the rest. Rows still owed
  // stay owed for the read that follows.
  #settlePage(entries: readonly FeedEntry[]): number {
    const start = this.#pageStart(entries)
    if (this.#state === 'ready' && !this.#inFlight && entries.length > 0 && this.#covers(entries)) {
      const whole = start === 0 && this.#complete
      this.#anchor = whole ? null : (entries[start]?.id ?? null)
      this.#owed = whole ? Number.POSITIVE_INFINITY : 0
    }
    return start
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
    const subagents = subagentId === null ? feedSubagents(rows) : []
    if (subagentId === null) this.#indexSubagents(sessionId, subagents)
    const start = this.#settlePage(entries)
    const reading = feedReading({
      sessionId,
      chainId: subagentId ?? sessionId,
      state: this.#state,
      error: this.#error,
      pendingPermissionId: pendingPermission(events),
      liveStatus: status?.type === 'status' ? status.status : null,
      entries: entries.slice(start),
      hasOlder: start > 0 || !this.#complete,
      subagents,
    })
    this.#loaded = entries
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
    for (const observer of this.#observers) observer(reading, entries)
  }
}

// One reader per observed chain, shared by every observer and stopped with the last. A Subagent's
// reader observes its parent's, so the parent reads as long as either is open.
export class SessionFeedReaders {
  readonly #context: SessionFeedReaderContext
  readonly #readers = new Map<string, FeedReader>()
  // A closed chain's last page: a reader that stopped mid-history reopens on it, not the newest page.
  readonly #pages = new Map<string, FeedPage>()

  constructor(context: SessionFeedReaderContext) {
    this.#context = context
  }

  observe(chain: FeedChain, observer: Observer): () => void {
    const pending =
      chain.subagentId === null ? pendingFeedReading(this.#context.database, chain.sessionId) : null
    if (pending !== null) {
      observer(pending, pending.entries)
      return () => {}
    }
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
      const page = this.#pages.get(key) ?? NEWEST_PAGE
      reader = new FeedReader(this.#context, chain, { parent, page })
      this.#readers.set(key, reader)
      reader.start()
    }
    const current = reader
    const unobserve = current.observe(observer)
    return () => {
      unobserve()
      if (current.observed || this.#readers.get(key) !== current) return
      this.#readers.delete(key)
      this.#pages.set(key, current.page)
      current.stop()
    }
  }

  // Whether an observed Feed has older rows to put before the page it published.
  loadOlder(chain: FeedChain): boolean {
    return this.#readers.get(feedChainKey(chain))?.loadOlder() ?? false
  }

  // Whether an observed Feed took the request; an unobserved one reads fresh when it opens.
  refresh(chain: FeedChain): boolean {
    const reader = this.#readers.get(feedChainKey(chain))
    reader?.refresh()
    return reader !== undefined
  }
}
