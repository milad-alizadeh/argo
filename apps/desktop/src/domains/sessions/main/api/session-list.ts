import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import { and, asc, count, desc, eq, inArray, not, or, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import {
  type SessionStatus,
  sessionSelectSchema,
  sessionStatusSchema,
} from '@/database/session/validation'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import { feedActivitySchema } from '@/domains/sessions/api/feed-activity'
import {
  isWorkingStatus,
  WORKING_SESSION_STATUSES,
} from '@/domains/sessions/api/session-live-event'
import { sessionTitleSchema } from '@/domains/sessions/api/session-title'
import { type StoredSubagent, storedSessionSubagents } from '../database/session-subagents'
import {
  type LiveSessionSupervisorActor,
  liveSessionActorFor,
} from '../live/live-session-supervisor-machine'
import { storedActivity } from './session-activities'
import type { SessionRosterChanges } from './session-roster-changes'

const t = initTRPC.create()

// One page of one Project's Sessions, newest first. Each filter narrows the same list.
const sessionListInputSchema = z.strictObject({
  projectId: z.string().min(1),
  filter: z.enum(['active', 'archived', 'all']).default('active'),
  search: z.string().trim().max(500).default(''),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(30),
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
const sessionTicketSchema = z.strictObject({
  projectId: identifierSchema,
  key: z.string().min(1),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  createdAt: z.iso.datetime(),
})

// The stored columns a row carries unchanged.
const storedSessionSchema = sessionSelectSchema.pick({
  harness: true,
  projectId: true,
  sortOrder: true,
  customTitle: true,
  preview: true,
  cwd: true,
  workspaceId: true,
})

// The Session screen reads `plan`, `shell`, the context sizes and the handoff links through
// `sessionDetails`, which shares this schema.
export const sessionListRowSchema = z.strictObject({
  ...storedSessionSchema.shape,
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
  posture: z.enum(['live', 'external']).nullable(),
  title: sessionTitleSchema.nullable(),
  status: sessionStatusSchema,
  updatedAt: z.string().nullable(),
  activity: feedActivitySchema.nullable(),
  plan: sessionPlanSchema.nullable(),
  subagents: z.array(sessionSubagentSchema),
  shell: z.array(sessionShellCommandSchema),
  ticket: sessionTicketSchema.nullable(),
  archived: z.boolean(),
  contextTokens: countSchema.nullable().optional(),
  contextWindowTokens: countSchema.nullable().optional(),
  handoffTo: identifierSchema.nullable().optional(),
  handoffFrom: identifierSchema.nullable().optional(),
  turnConfiguration: z.strictObject({
    model: z.string().nullable(),
    effort: z.string().nullable(),
    mode: z.string().nullable(),
  }),
})

const sessionListSchema = z.strictObject({
  total: z.number().int().nonnegative(),
  rows: z.array(sessionListRowSchema),
})

type StoredSessionTitle = {
  customTitle: string | null
  preview: string | null
  firstPrompt: string | null
}

export type SessionListContext = {
  database: Database
  supervisor: LiveSessionSupervisorActor
  roster: SessionRosterChanges
}

// The Feed's activity names no tool or target, so the row keeps its kind as the tool. It outranks
// the live channel's own.
function observedActivity(stored: string | null): z.infer<typeof feedActivitySchema> | null {
  const activity = storedActivity(stored)
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

function sessionListRow(
  context: SessionListContext,
  row: StoredSessionTitle & {
    id: string
    harness: string
    nativeId: string
    projectId: string | null
    createdAt: number
    sortOrder: number
    cwd: string | null
    workspaceId: string | null
    activityAt: number | null
    activity: string | null
    status: SessionStatus | null
    updatedAt: number
    ticket: {
      projectId: string
      key: string
      title: string
      state: string
      createdAt: string
    } | null
    archived: boolean
  },
  subagents: readonly StoredSubagent[],
) {
  const live = liveProjection(context, row.id)
  const liveStatus = live?.status === 'unknown' ? null : live?.status
  const ticket =
    row.ticket === null ? null : { ...row.ticket, state: ticketStateOf(row.ticket.state) }
  return {
    id: row.id,
    harness: row.harness,
    projectId: row.projectId,
    createdAt: new Date(row.createdAt).toISOString(),
    sortOrder: row.sortOrder,
    posture: live?.posture ?? null,
    customTitle: row.customTitle,
    preview: row.preview,
    title: displayedTitle({ ...row, ticketTitle: ticket?.title ?? null }),
    status: liveStatus ?? row.status ?? 'unknown',
    cwd: row.cwd,
    workspaceId: row.workspaceId,
    updatedAt: new Date(row.activityAt ?? row.updatedAt).toISOString(),
    activity: observedActivity(row.activity) ?? live?.activity ?? null,
    plan: null,
    subagents: subagents.map((subagent) => ({ ...subagent, startedAt: null, endedAt: null })),
    shell: [],
    ticket,
    archived: row.archived,
    turnConfiguration: live?.turnConfiguration ?? { model: null, effort: null, mode: null },
  }
}

const storedSessionColumns = {
  id: sessionTable.argoId,
  harness: sessionTable.harness,
  nativeId: sessionTable.nativeId,
  projectId: sessionTable.projectId,
  createdAt: sessionTable.createdAt,
  sortOrder: sessionTable.sortOrder,
  customTitle: sessionTable.customTitle,
  preview: sessionTable.preview,
  firstPrompt: sessionTable.firstPrompt,
  cwd: sessionTable.cwd,
  workspaceId: sessionTable.workspaceId,
  activityAt: sessionTable.activityAt,
  activity: sessionTable.activity,
  status: sessionTable.status,
  updatedAt: sessionTable.updatedAt,
  ticket: {
    projectId: sessionTicketLink.projectId,
    key: sessionTicketLink.ticketKey,
    title: sessionTicketLink.title,
    state: sessionTicketLink.state,
    createdAt: sessionTicketLink.createdAt,
  },
}

const sessionIsArchived = sql<boolean>`exists (select 1 from session_archive where session_archive.session_id = ${sessionTable.argoId})`

// Runs `publish` once in the next microtask for any burst of `changed` calls, until stopped.
function coalescedChanges(publish: () => void) {
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

// The Session List rows `where` selects, in list order.
export function readSessionRows(
  context: SessionListContext,
  where: SQL | undefined,
  page?: { limit: number; offset: number },
): z.infer<typeof sessionListRowSchema>[] {
  const query = context.database
    .select({ ...storedSessionColumns, archived: sessionIsArchived })
    .from(sessionTable)
    .leftJoin(sessionTicketLink, eq(sessionTicketLink.sessionId, sessionTable.argoId))
    .where(where)
    .orderBy(asc(sessionTable.sortOrder), desc(sessionTable.createdAt), asc(sessionTable.argoId))
  const stored =
    page === undefined ? query.all() : query.limit(page.limit).offset(page.offset).all()
  const subagents = storedSessionSubagents(
    context.database,
    stored.map((row) => row.id),
  )
  return stored.map((row) =>
    sessionListRow(
      context,
      { ...row, archived: Boolean(row.archived) },
      subagents.get(row.id) ?? [],
    ),
  )
}

function readSessionList(
  context: SessionListContext,
  input: z.infer<typeof sessionListInputSchema>,
): z.infer<typeof sessionListSchema> {
  const filters = {
    active: not(sessionIsArchived),
    archived: sessionIsArchived,
    all: undefined,
  } as const satisfies Record<typeof input.filter, SQL | undefined>
  const where = and(
    eq(sessionTable.projectId, input.projectId),
    filters[input.filter],
    input.search === ''
      ? undefined
      : or(
          sql<boolean>`instr(lower(coalesce(${sessionTable.customTitle}, '')), lower(${input.search})) > 0`,
          sql<boolean>`instr(lower(coalesce(${sessionTable.preview}, '')), lower(${input.search})) > 0`,
        ),
  )
  const rows = readSessionRows(context, where, { limit: input.limit, offset: input.offset })
  const total =
    context.database.select({ value: count() }).from(sessionTable).where(where).get()?.value ?? 0
  return { total, rows }
}

export function sessionListProcedure(context: SessionListContext) {
  return t.procedure
    .input(sessionListInputSchema)
    .output(sessionListSchema)
    .query(({ input }) => readSessionList(context, input))
}

// The Sessions working now: a live channel's status, or else the one the history watcher stored.
function workingSessionIds(context: SessionListContext): Set<string> {
  const stored = context.database
    .select({ id: sessionTable.argoId })
    .from(sessionTable)
    .where(inArray(sessionTable.status, [...WORKING_SESSION_STATUSES]))
    .all()
  const working = new Set(stored.map((row) => row.id))
  for (const sessionId of Object.keys(context.supervisor.getSnapshot().context.sessions)) {
    const status = liveProjection(context, sessionId)?.status
    if (status !== undefined && isWorkingStatus(status)) working.add(sessionId)
  }
  return working
}

// Only a working Session has an activity line to read, so idle rows open no Feed reader.
function observeWorkingFeeds(
  observed: Map<string, () => void>,
  working: ReadonlySet<string>,
  observeFeed: (sessionId: string) => () => void,
): void {
  for (const [sessionId, stop] of observed)
    if (!working.has(sessionId)) {
      observed.delete(sessionId)
      stop()
    }
  for (const sessionId of working)
    if (!observed.has(sessionId)) observed.set(sessionId, observeFeed(sessionId))
}

// Announces the saved Sessions a write changed; each Session List reads its pages again.
export function sessionListChangedProcedure(
  context: SessionListContext,
  observeFeed: (sessionId: string) => () => void,
) {
  return t.procedure.subscription(() =>
    observable<{ sessionIds: string[] }>((emit) => {
      const observed = new Map<string, () => void>()
      const changedIds = new Set<string>()
      const { changed, stop } = coalescedChanges(() => {
        const sessionIds = [...changedIds]
        changedIds.clear()
        emit.next({ sessionIds })
        observeWorkingFeeds(observed, workingSessionIds(context), observeFeed)
      })
      const collect = (sessionIds: readonly string[]) => {
        for (const sessionId of sessionIds) changedIds.add(sessionId)
        changed()
      }
      const unsubscribeRoster = context.roster.subscribe(collect)
      const statusChanges = context.supervisor.on('Session status changed', ({ sessionId }) =>
        collect([sessionId]),
      )
      observeWorkingFeeds(observed, workingSessionIds(context), observeFeed)
      return () => {
        stop()
        unsubscribeRoster()
        statusChanges.unsubscribe()
        for (const stopObserving of observed.values()) stopObserving()
        observed.clear()
      }
    }),
  )
}
