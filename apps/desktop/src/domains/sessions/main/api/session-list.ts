import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { and, asc, count, desc, eq, inArray, not, or, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import { feedActivitySchema } from '@/domains/sessions/api/feed-activity'
import { sessionTitleSchema } from '@/domains/sessions/api/session-title'
import { type StoredSubagent, storedSessionSubagents } from '../database/session-subagents'
import {
  type LiveSessionSupervisorActor,
  liveSessionActorFor,
} from '../live/live-session-supervisor-machine'
import type { SessionActivities } from './session-activities'
import type { SessionRosterChanges } from './session-roster-changes'
import type { WatchedSessionStatus } from './watched-session-status'

const t = initTRPC.create()

// The largest window one read returns on each side of its anchor.
export const SESSION_LIST_WINDOW_SIDE = 60

// One bounded window of a Session List view, sought around an anchor in list order. `view` names
// the renderer's list view, whose temporary Feed readers follow its latest window.
const sessionListAnchorSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('start') }),
  z.strictObject({ kind: z.literal('end') }),
  z.strictObject({
    kind: z.literal('key'),
    listOrderAt: z.number().int(),
    id: z.string().uuid(),
  }),
  z.strictObject({ kind: z.literal('index'), index: z.number().int().nonnegative() }),
])

const sessionListWindowInputSchema = z.strictObject({
  projectId: z.string().min(1),
  search: z.string().trim().max(500).default(''),
  view: z.string().uuid(),
  anchor: sessionListAnchorSchema,
  before: z.number().int().min(0).max(SESSION_LIST_WINDOW_SIDE).default(0),
  after: z.number().int().min(1).max(SESSION_LIST_WINDOW_SIDE).default(30),
})

const sessionListChangesInputSchema = z.strictObject({ view: z.string().uuid() })

const identifierSchema = z.string().min(1)
const countSchema = z.number().int().nonnegative()
const sessionPlanSchema = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.literal('available'),
    entries: z.array(
      z.strictObject({
        content: z.string().trim().min(1),
        position: countSchema,
        status: z.enum(['pending', 'in_progress', 'completed']),
      }),
    ),
  }),
  z.strictObject({ state: z.literal('malformed') }),
])
const sessionSubagentSchema = z.strictObject({
  id: identifierSchema,
  label: z.string().nullable(),
  state: z.enum(['running', 'completed', 'failed', 'interrupted']),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
})
const sessionShellCommandSchema = z.strictObject({
  id: identifierSchema,
  command: z.string().nullable(),
  label: z.string().nullable(),
  background: z.boolean(),
  state: z.enum(['running', 'completed', 'failed', 'interrupted']),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  outputPath: z.string().nullable(),
  result: z.string().nullable(),
})
const sessionPullRequestSchema = z.strictObject({
  number: countSchema,
  url: z.string(),
  repository: z.string().nullable(),
})
const sessionTicketSchema = z.strictObject({
  projectId: identifierSchema,
  key: z.string().min(1),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  createdAt: z.iso.datetime(),
})

export const sessionListRowSchema = z.strictObject({
  id: z.string().uuid(),
  listOrderAt: z.number().int(),
  retiredIds: z.array(z.string().uuid()),
  harness: z.string().min(1),
  posture: z.enum(['live', 'external']).nullable(),
  customTitle: z.string().nullable(),
  preview: z.string().nullable(),
  title: sessionTitleSchema.nullable(),
  status: z.enum([
    'starting',
    'running',
    'permission',
    'asking',
    'idle',
    'stopped',
    'ended',
    'unknown',
  ]),
  cwd: z.string().nullable(),
  workspaceId: z.string().min(1).nullable(),
  branch: z.string().nullable(),
  updatedAt: z.string().nullable(),
  turnStartedAt: z.string().nullable(),
  activity: feedActivitySchema.nullable(),
  plan: sessionPlanSchema.nullable(),
  subagents: z.array(sessionSubagentSchema),
  shell: z.array(sessionShellCommandSchema),
  pullRequest: sessionPullRequestSchema.nullable(),
  ticket: sessionTicketSchema.nullable(),
  archived: z.boolean(),
  unread: z.boolean(),
  searchExcerpt: z.string().optional(),
  contextTokens: countSchema.nullable().optional(),
  contextWindowTokens: countSchema.nullable().optional(),
  spentTokens: countSchema.nullable().optional(),
  compactionStartedAt: z.string().datetime().nullable().optional(),
  compactionPercentage: z.number().int().min(0).max(100).nullable().optional(),
  compactionTokens: z.string().nullable().optional(),
  handoffStartedAt: z.string().datetime().nullable().optional(),
  handoffFailure: z.string().nullable().optional(),
  handoffTo: identifierSchema.nullable().optional(),
  handoffFrom: identifierSchema.nullable().optional(),
  turnConfiguration: z.strictObject({
    model: z.string().nullable(),
    effort: z.string().nullable(),
    mode: z.string().nullable(),
  }),
})

// `offset` is the list position of the first row.
const sessionListWindowSchema = z.strictObject({
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  rows: z.array(sessionListRowSchema),
})

// Something a list view shows may have changed, so it reads its window again. The first is sent
// once the listener is attached, so a commit before the first read is never missed.
export const sessionListChangeSchema = z.strictObject({ type: z.literal('invalidated') })

type StoredSessionTitle = {
  customTitle: string | null
  preview: string | null
  firstPrompt: string | null
}

export type SessionListContext = {
  database: Database
  supervisor: LiveSessionSupervisorActor
  roster: SessionRosterChanges
  watchedStatus: Pick<WatchedSessionStatus, 'statusOf'>
  // The activity an observed Feed published; it outranks the live channel's own.
  activities?: SessionActivities
}

// The Feed's activity names no tool or target, so the row keeps its kind as the tool.
function observedActivity(
  context: SessionListContext,
  sessionId: string,
): z.infer<typeof feedActivitySchema> | null {
  const activity = context.activities?.activityOf(sessionId) ?? null
  return activity === null ? null : { ...activity, tool: activity.kind, target: null }
}

function liveProjection(context: SessionListContext, sessionId: string) {
  const actor = liveSessionActorFor(context.supervisor, sessionId)
  if (actor === undefined) return null
  const snapshot = actor.getSnapshot()
  const stateProjection = {
    Starting: { posture: 'live', status: 'starting' },
    Persisting: { posture: 'live', status: 'starting' },
    'Awaiting turn': { posture: 'live', status: 'starting' },
    Draining: { posture: 'live', status: 'unknown' },
    Sending: { posture: 'live', status: 'unknown' },
    Ready: { posture: 'live', status: 'unknown' },
    Failed: null,
    Closed: null,
  } as const satisfies Record<
    typeof snapshot.value,
    { posture: 'live'; status: 'starting' | 'unknown' } | null
  >
  const projection = stateProjection[snapshot.value]
  if (projection === null) return null
  return {
    posture: projection.posture,
    status: snapshot.context.status ?? projection.status,
    activity: snapshot.context.activity?.activity ?? null,
    turnConfiguration: snapshot.context.turnConfiguration,
  }
}

function displayedTitle(
  row: StoredSessionTitle & { ticketTitle: string | null },
): z.infer<typeof sessionTitleSchema> | null {
  if (row.customTitle !== null) return { text: row.customTitle, source: 'custom' }
  if (row.ticketTitle !== null) return { text: row.ticketTitle, source: 'ticket' }
  if (row.preview !== null && row.preview !== row.firstPrompt)
    return { text: row.preview, source: 'summarised' }
  if (row.firstPrompt !== null) return { text: row.firstPrompt, source: 'first-prompt' }
  return null
}

function ticketStateOf(value: string): 'open' | 'closed' {
  return z.enum(['open', 'closed']).parse(value)
}

export function sessionListRow(
  context: SessionListContext,
  row: StoredSessionTitle & {
    id: string
    harness: string
    nativeId: string
    cwd: string | null
    workspaceId: string | null
    activityAt: number | null
    listOrderAt: number
    updatedAt: number
    ticket: {
      projectId: string
      key: string
      title: string
      state: string
      createdAt: string
    } | null
    archived?: boolean
  },
  subagents: readonly StoredSubagent[],
) {
  const live = liveProjection(context, row.id)
  const watched = context.watchedStatus.statusOf(row.harness, row.nativeId, Date.now())
  const liveStatus = live?.status === 'unknown' ? null : live?.status
  const ticket =
    row.ticket === null ? null : { ...row.ticket, state: ticketStateOf(row.ticket.state) }
  return {
    id: row.id,
    listOrderAt: row.listOrderAt,
    retiredIds: [],
    harness: row.harness,
    posture: live?.posture ?? null,
    customTitle: row.customTitle,
    preview: row.preview,
    title: displayedTitle({ ...row, ticketTitle: ticket?.title ?? null }),
    status: liveStatus ?? watched ?? ('unknown' as const),
    cwd: row.cwd,
    workspaceId: row.workspaceId,
    branch: null,
    updatedAt: new Date(row.activityAt ?? row.updatedAt).toISOString(),
    turnStartedAt: null,
    activity: observedActivity(context, row.id) ?? live?.activity ?? null,
    plan: null,
    subagents: subagents.map((subagent) => ({ ...subagent, startedAt: null, endedAt: null })),
    shell: [],
    pullRequest: null,
    ticket,
    archived: row.archived ?? false,
    unread: false,
    turnConfiguration: live?.turnConfiguration ?? { model: null, effort: null, mode: null },
  }
}

export const storedSessionColumns = {
  id: sessionTable.argoId,
  harness: sessionTable.harness,
  nativeId: sessionTable.nativeId,
  customTitle: sessionTable.customTitle,
  preview: sessionTable.preview,
  firstPrompt: sessionTable.firstPrompt,
  cwd: sessionTable.cwd,
  workspaceId: sessionTable.workspaceId,
  activityAt: sessionTable.activityAt,
  listOrderAt: sessionTable.listOrderAt,
  updatedAt: sessionTable.updatedAt,
  ticket: {
    projectId: sessionTicketLink.projectId,
    key: sessionTicketLink.ticketKey,
    title: sessionTicketLink.title,
    state: sessionTicketLink.state,
    createdAt: sessionTicketLink.createdAt,
  },
}

export const sessionIsArchived = sql<boolean>`exists (select 1 from session_archive where session_archive.session_id = ${sessionTable.argoId})`

// Runs `publish` once in the next microtask for any burst of `changed` calls, until stopped.
export function coalescedChanges(publish: () => void) {
  let pending = false
  let stopped = false
  return {
    changed() {
      if (pending || stopped) return
      pending = true
      queueMicrotask(() => {
        pending = false
        if (!stopped) publish()
      })
    },
    stop() {
      stopped = true
    },
  }
}

function storedSessionRows(database: Database) {
  return database
    .select(storedSessionColumns)
    .from(sessionTable)
    .leftJoin(sessionTicketLink, eq(sessionTicketLink.sessionId, sessionTable.argoId))
}

export function sessionListFilter(input: { projectId: string; search: string }): SQL | undefined {
  return and(
    eq(sessionTable.projectId, input.projectId),
    not(sessionIsArchived),
    input.search === ''
      ? undefined
      : or(
          sql<boolean>`instr(lower(coalesce(${sessionTable.customTitle}, '')), lower(${input.search})) > 0`,
          sql<boolean>`instr(lower(coalesce(${sessionTable.preview}, '')), lower(${input.search})) > 0`,
        ),
  )
}

type ListKey = { listOrderAt: number; id: string }

// The list runs newest first: a larger key is earlier. Both seeks walk `session_list_order`.
const listKey = sql`(${sessionTable.listOrderAt}, ${sessionTable.argoId})`
const earlierThan = (key: ListKey) => sql`${listKey} > (${key.listOrderAt}, ${key.id})`
const atOrLaterThan = (key: ListKey) => sql`${listKey} <= (${key.listOrderAt}, ${key.id})`

// One list view's rows: the database and the filter every seek and count in a read shares.
type ListScope = { database: Database; filter: SQL | undefined }

function countWhere({ database, filter }: ListScope, condition?: SQL): number {
  return (
    database.select({ value: count() }).from(sessionTable).where(and(filter, condition)).get()
      ?.value ?? 0
  )
}

// Exported for its query plan test.
export function seekLaterQuery(
  { database, filter }: ListScope,
  key: ListKey | null,
  limit: number,
) {
  return storedSessionRows(database)
    .where(key === null ? filter : and(filter, atOrLaterThan(key)))
    .orderBy(desc(sessionTable.listOrderAt), desc(sessionTable.argoId))
    .limit(limit)
}

function seekEarlier({ database, filter }: ListScope, key: ListKey, limit: number) {
  if (limit === 0) return []
  return storedSessionRows(database)
    .where(and(filter, earlierThan(key)))
    .orderBy(asc(sessionTable.listOrderAt), asc(sessionTable.argoId))
    .limit(limit)
    .all()
    .reverse()
}

// A position jump, from a scrollbar drag or End, reads only index keys up to that position.
function keyAtIndex({ database, filter }: ListScope, index: number): ListKey | null {
  return (
    database
      .select({ listOrderAt: sessionTable.listOrderAt, id: sessionTable.argoId })
      .from(sessionTable)
      .where(filter)
      .orderBy(desc(sessionTable.listOrderAt), desc(sessionTable.argoId))
      .limit(1)
      .offset(index)
      .get() ?? null
  )
}

function anchorKey(
  scope: ListScope,
  anchor: z.infer<typeof sessionListAnchorSchema>,
  total: number,
): ListKey | null {
  const last = Math.max(total - 1, 0)
  switch (anchor.kind) {
    case 'start':
      return null
    case 'end':
      return keyAtIndex(scope, last)
    case 'key':
      return { listOrderAt: anchor.listOrderAt, id: anchor.id }
    case 'index':
      return keyAtIndex(scope, Math.min(anchor.index, last))
  }
}

function readSessionListWindow(
  context: SessionListContext,
  input: z.infer<typeof sessionListWindowInputSchema>,
): z.infer<typeof sessionListWindowSchema> {
  const scope = { database: context.database, filter: sessionListFilter(input) }
  const total = countWhere(scope)
  const key = anchorKey(scope, input.anchor, total)
  const earlier = key === null ? [] : seekEarlier(scope, key, input.before)
  const later = seekLaterQuery(scope, key, input.after).all()
  const stored = [...earlier, ...later]
  const first = stored[0]
  const offset = first === undefined ? total : countWhere(scope, earlierThan(first))
  const subagents = storedSessionSubagents(
    context.database,
    stored.map((row) => row.id),
  )
  const rows = stored.map((row) => sessionListRow(context, row, subagents.get(row.id) ?? []))
  return sessionListWindowSchema.parse({ total, offset, rows })
}

export function rowsForSessionIds(
  context: SessionListContext,
  projectId: string,
  ids: readonly string[],
) {
  if (ids.length === 0) return []
  const stored = storedSessionRows(context.database)
    .where(and(eq(sessionTable.projectId, projectId), inArray(sessionTable.argoId, [...ids])))
    .all()
  const subagents = storedSessionSubagents(
    context.database,
    stored.map((row) => row.id),
  )
  return stored.map((row) =>
    sessionListRow(context, { ...row, archived: true }, subagents.get(row.id) ?? []),
  )
}

// The temporary Feed readers a list view holds: only its latest window's rows, released with it.
// Shared readers are counted, so releasing a row never closes the Feed a reader has open.
export class SessionListFeedObservers {
  readonly #views = new Map<string, Map<string, () => void>>()
  readonly #observeFeed: ((sessionId: string) => () => void) | undefined

  constructor(observeFeed?: (sessionId: string) => () => void) {
    this.#observeFeed = observeFeed
  }

  attach(view: string): () => void {
    const observed = new Map<string, () => void>()
    this.#views.set(view, observed)
    return () => {
      if (this.#views.get(view) === observed) this.#views.delete(view)
      for (const stop of observed.values()) stop()
      observed.clear()
    }
  }

  retain(view: string, sessionIds: readonly string[]): void {
    const observed = this.#views.get(view)
    if (observed === undefined || this.#observeFeed === undefined) return
    const retained = new Set(sessionIds)
    for (const [sessionId, stop] of observed)
      if (!retained.has(sessionId)) {
        observed.delete(sessionId)
        stop()
      }
    for (const sessionId of retained)
      if (!observed.has(sessionId)) observed.set(sessionId, this.#observeFeed(sessionId))
  }

  get size(): number {
    let size = 0
    for (const observed of this.#views.values()) size += observed.size
    return size
  }
}

export function sessionListProcedures(
  context: SessionListContext,
  observers: SessionListFeedObservers = new SessionListFeedObservers(),
) {
  return {
    sessionListWindow: t.procedure.input(sessionListWindowInputSchema).query(({ input }) => {
      const window = readSessionListWindow(context, input)
      observers.retain(
        input.view,
        window.rows.map((row) => row.id),
      )
      return window
    }),
    sessionListChanges: t.procedure.input(sessionListChangesInputSchema).subscription(({ input }) =>
      observable<z.infer<typeof sessionListChangeSchema>>((emit) => {
        const { changed, stop } = coalescedChanges(() => emit.next({ type: 'invalidated' }))
        const detach = observers.attach(input.view)
        const unsubscribeRoster = context.roster.subscribe(changed)
        const statusChanges = context.supervisor.on('Session status changed', changed)
        emit.next({ type: 'invalidated' })
        return () => {
          stop()
          unsubscribeRoster()
          statusChanges.unsubscribe()
          detach()
        }
      }),
    ),
  }
}
