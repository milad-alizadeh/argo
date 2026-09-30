import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { and, asc, count, desc, eq, inArray, not, or, sql } from 'drizzle-orm'
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

// The roster reads the newest `pages` pages; loading more asks for one page more.
const sessionListInputSchema = z.strictObject({
  projectId: z.string().min(1),
  search: z.string().trim().max(500).default(''),
  pages: z.number().int().min(1).max(1_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
})

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

const sessionListRowSchema = z.strictObject({
  id: z.string().uuid(),
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

const sessionListSchema = z.strictObject({
  pages: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  rows: z.array(sessionListRowSchema),
})

// The whole list first, and again whenever the rows or their order change; otherwise each row
// that changed on its own.
export const sessionListUpdateSchema = z.discriminatedUnion('type', [
  sessionListSchema.extend({ type: z.literal('list') }),
  z.strictObject({ type: z.literal('row'), row: sessionListRowSchema }),
])

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

function readSessionList(
  context: SessionListContext,
  input: z.infer<typeof sessionListInputSchema>,
): z.infer<typeof sessionListSchema> {
  const projectFilter = eq(sessionTable.projectId, input.projectId)
  const filter = and(
    projectFilter,
    not(sessionIsArchived),
    input.search === ''
      ? undefined
      : or(
          sql<boolean>`instr(lower(coalesce(${sessionTable.customTitle}, '')), lower(${input.search})) > 0`,
          sql<boolean>`instr(lower(coalesce(${sessionTable.preview}, '')), lower(${input.search})) > 0`,
        ),
  )
  const stored = storedSessionRows(context.database)
    .where(filter)
    .orderBy(
      desc(sql`coalesce(${sessionTable.activityAt}, ${sessionTable.updatedAt})`),
      asc(sessionTable.argoId),
    )
    .limit(input.pages * input.pageSize)
    .all()
  const subagents = storedSessionSubagents(
    context.database,
    stored.map((row) => row.id),
  )
  const rows = stored.map((row) => sessionListRow(context, row, subagents.get(row.id) ?? []))
  const total =
    context.database.select({ value: count() }).from(sessionTable).where(filter).get()?.value ?? 0
  return sessionListSchema.parse({ pages: input.pages, pageSize: input.pageSize, total, rows })
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

function sameOrder(
  left: z.infer<typeof sessionListSchema>,
  right: z.infer<typeof sessionListSchema>,
): boolean {
  return (
    left.total === right.total &&
    left.rows.length === right.rows.length &&
    left.rows.every((row, index) => row.id === right.rows[index]?.id)
  )
}

function observeVisibleFeeds(
  observed: Map<string, () => void>,
  rows: readonly z.infer<typeof sessionListRowSchema>[],
  observeFeed: ((sessionId: string) => () => void) | undefined,
): void {
  const visible = new Set(rows.map((row) => row.id))
  for (const [sessionId, stop] of observed)
    if (!visible.has(sessionId)) {
      observed.delete(sessionId)
      stop()
    }
  for (const sessionId of visible)
    if (!observed.has(sessionId) && observeFeed !== undefined)
      observed.set(sessionId, observeFeed(sessionId))
}

export function sessionListProcedure(
  context: SessionListContext,
  observeFeed?: (sessionId: string) => () => void,
) {
  return t.procedure.input(sessionListInputSchema).subscription(({ input }) =>
    observable<z.infer<typeof sessionListUpdateSchema>>((emit) => {
      let sent = readSessionList(context, input)
      emit.next({ type: 'list', ...sent })
      const observed = new Map<string, () => void>()
      const { changed, stop } = coalescedChanges(() => {
        const next = readSessionList(context, input)
        if (!sameOrder(sent, next)) emit.next({ type: 'list', ...next })
        else
          next.rows.forEach((row, index) => {
            if (JSON.stringify(row) !== JSON.stringify(sent.rows[index]))
              emit.next({ type: 'row', row })
          })
        sent = next
        observeVisibleFeeds(observed, next.rows, observeFeed)
      })
      const unsubscribeRoster = context.roster.subscribe(changed)
      const statusChanges = context.supervisor.on('Session status changed', changed)
      observeVisibleFeeds(observed, sent.rows, observeFeed)
      return () => {
        stop()
        unsubscribeRoster()
        statusChanges.unsubscribe()
        for (const stop of observed.values()) stop()
        observed.clear()
      }
    }),
  )
}
