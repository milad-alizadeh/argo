import { initTRPC } from '@trpc/server'
import { observable } from '@trpc/server/observable'
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  isNotNull,
  isNull,
  type SQL,
  sql,
} from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { createSelectSchema } from 'drizzle-orm/zod'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionSelectSchema } from '@/database/session/validation'
import { sessionArchive } from '@/database/session-archive/schema'
import { sessionSubagent } from '@/database/session-subagent/schema'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import { ticketTable } from '@/database/ticket/schema'
import type { TicketScopeTarget } from '@/database/ticket/validation'
import { ticketContent } from '@/database/ticket-content/schema'
import { ticketContentSelectSchema } from '@/database/ticket-content/validation'
import { type LiveActivity, liveActivitySchema } from '@/domains/sessions/api/feed'
import { planProgressSchema } from '@/domains/sessions/api/feed-content'
import { reportedTurnConfigurationSchema } from '@/domains/sessions/api/reported-turn-configuration'
import { sessionListInputSchema } from '@/domains/sessions/api/session-list-input'
import { identifierSchema } from '@/shared/validation'
import { type StoredSubagent, storedSessionSubagents } from '../database'
import { type LiveSessionSupervisorActor, liveSessionActorFor } from '../live'
import type { SessionListChanges } from './session-list-changes'
import { updateSession } from './session-update'

const t = initTRPC.create()

const storedSubagent = createSelectSchema(sessionSubagent).shape
const sessionSubagentSchema = z.strictObject({
  id: identifierSchema,
  label: storedSubagent.label,
  state: storedSubagent.state,
})
const storedTicketLink = createSelectSchema(sessionTicketLink).shape
const savedTicket = ticketContentSelectSchema.shape
// The linked Ticket's provider facts are null until its content is saved.
const sessionTicketSchema = z.strictObject({
  projectId: storedTicketLink.projectId,
  key: storedTicketLink.ticketKey,
  title: savedTicket.title.nullable(),
  state: savedTicket.state.nullable(),
  createdAt: z.iso.datetime(),
})

// The stored columns a row carries unchanged.
const passed = { harness: true, projectId: true, cwd: true, workspaceId: true } as const
const storedSessionSchema = sessionSelectSchema.pick(passed)
const sessionColumns = getTableColumns(sessionTable)
const passedSessionColumns = Object.fromEntries(
  Object.keys(passed).map((column) => [column, sessionColumns[column as keyof typeof passed]]),
) as Pick<typeof sessionColumns, keyof typeof passed>

export const sessionListRowSchema = z.strictObject({
  ...storedSessionSchema.shape,
  id: z.string().uuid(),
  posture: z.literal('live').nullable(),
  name: z.string(),
  status: sessionSelectSchema.shape.status,
  updatedAt: z.iso.datetime(),
  activity: liveActivitySchema.nullable(),
  subagents: z.array(sessionSubagentSchema),
  ticket: sessionTicketSchema.nullable(),
  archived: z.boolean(),
  turnConfiguration: reportedTurnConfigurationSchema,
  planProgress: planProgressSchema.nullable(),
})

const sessionListSchema = z.strictObject({
  total: z.number().int().nonnegative(),
  rows: z.array(sessionListRowSchema),
})

export type SessionListContext = {
  database: Database
  supervisor: LiveSessionSupervisorActor
  changes: SessionListChanges
  // The provider scope a Project's Tickets are saved under; null with no Ticket Connection.
  ticketSource: (projectId: string) => Promise<TicketScopeTarget | null>
}

type LinkedTicketSource = TicketScopeTarget & { projectId: string }

async function linkedTicketSource(
  context: SessionListContext,
  projectId: string,
): Promise<LinkedTicketSource | null> {
  const source = await context.ticketSource(projectId)
  return source === null ? null : { ...source, projectId }
}

// A stored value of an unknown shape reads as null, so one bad row leaves the list readable.
function storedValue<Schema extends z.ZodType>(
  schema: Schema,
  stored: unknown,
  name: string,
): z.infer<Schema> | null {
  if (stored === null) return null
  const parsed = schema.safeParse(stored)
  if (parsed.success) return parsed.data
  console.warn(`Rejected 1 unsupported stored Session ${name}.`)
  return null
}

function storedActivity(stored: string | null): LiveActivity | null {
  return stored === null ? null : storedValue(liveActivitySchema, JSON.parse(stored), 'activity')
}

function liveProjection(context: Pick<SessionListContext, 'supervisor'>, sessionId: string) {
  const actor = liveSessionActorFor(context.supervisor, sessionId)
  if (actor === undefined) return null
  const snapshot = actor.getSnapshot()
  const statusByState = {
    Starting: 'starting',
    Persisting: 'starting',
    'Awaiting turn': 'starting',
    Draining: 'unknown',
    Sending: 'unknown',
    Ready: 'unknown',
    Failed: null,
    Closed: null,
  } as const satisfies Record<typeof snapshot.value, 'starting' | 'unknown' | null>
  const status = statusByState[snapshot.value]
  if (status === null) return null
  return {
    status: snapshot.context.status ?? status,
    activity: snapshot.context.activity?.activity ?? null,
    turnConfiguration: snapshot.context.turnConfiguration,
  }
}

function sessionListRow(
  context: SessionListContext,
  row: StoredSessionRow,
  subagents: StoredSubagent[],
) {
  const live = liveProjection(context, row.id)
  const liveStatus = live?.status === 'unknown' ? null : live?.status
  return {
    ...row.passed,
    id: row.id,
    posture: live === null ? null : ('live' as const),
    name: row.name,
    status: liveStatus ?? row.status,
    updatedAt: new Date(row.activityAt ?? row.updatedAt).toISOString(),
    // A live channel's own activity outranks the stored line, which no Feed reader keeps fresh.
    activity: live?.activity ?? storedActivity(row.activity),
    subagents,
    ticket: linkedTicket(row.ticket),
    archived: row.archived,
    // A live channel's own configuration outranks the stored one, as its status does.
    turnConfiguration: live?.turnConfiguration ??
      storedValue(reportedTurnConfigurationSchema, row.turnConfiguration, 'turn configuration') ?? {
        model: null,
        effort: null,
        mode: null,
      },
    planProgress: storedValue(planProgressSchema, row.planProgress, 'Plan progress'),
  }
}

// A Session with no link joins no row, so every link column is null.
function linkedTicket({ projectId, key, createdAt, ...content }: StoredSessionRow['ticket']) {
  return projectId === null || key === null || createdAt === null
    ? null
    : { projectId, key, createdAt, ...content }
}

// The name a row shows, strongest first, down to the Session ID.
const shownName = sql<string>`coalesce(${sessionTable.customTitle}, ${ticketContent.title}, ${sessionTable.preview}, ${sessionTable.firstPrompt}, ${sessionTable.argoId})`

const storedSessionColumns = {
  passed: passedSessionColumns,
  id: sessionTable.argoId,
  name: shownName,
  activityAt: sessionTable.activityAt,
  activity: sessionTable.activity,
  status: sessionTable.status,
  updatedAt: sessionTable.updatedAt,
  turnConfiguration: sessionTable.turnConfiguration,
  planProgress: sessionTable.planProgress,
  ticket: {
    projectId: sessionTicketLink.projectId,
    key: sessionTicketLink.ticketKey,
    title: ticketContent.title,
    state: ticketContent.state,
    createdAt: sessionTicketLink.createdAt,
  },
  archived: isNotNull(sessionArchive.sessionId).mapWith(Boolean),
}

const sessionListOrder = [
  asc(sessionTable.sortOrder),
  desc(sessionTable.createdAt),
  asc(sessionTable.argoId),
]

const keyedContent = alias(ticketContent, 'keyed_ticket_content')

// The saved Ticket a link's key names in the Project's Ticket scope; the first if keys repeat.
function linkedTicketId(database: Database, source: LinkedTicketSource | null): SQL {
  if (source === null) return sql`null`
  const found = database
    .select({ id: ticketTable.argoId })
    .from(ticketTable)
    .innerJoin(keyedContent, eq(keyedContent.ticketId, ticketTable.argoId))
    .where(
      and(
        eq(ticketTable.provider, source.provider),
        eq(ticketTable.scope, source.scope),
        eq(keyedContent.key, sessionTicketLink.ticketKey),
        eq(sessionTicketLink.projectId, source.projectId),
      ),
    )
    .limit(1)
  return sql`(${found})`
}

// The stored Sessions `where` selects, with their linked Ticket, archive mark and match count.
function storedSessionQuery(
  database: Database,
  where: SQL | undefined,
  source: LinkedTicketSource | null,
) {
  return database
    .select({ ...storedSessionColumns, total: sql<number>`count(*) over ()`.mapWith(Number) })
    .from(sessionTable)
    .leftJoin(sessionTicketLink, eq(sessionTicketLink.sessionId, sessionTable.argoId))
    .leftJoin(ticketContent, eq(ticketContent.ticketId, linkedTicketId(database, source)))
    .leftJoin(sessionArchive, eq(sessionArchive.sessionId, sessionTable.argoId))
    .where(where)
}

type StoredSessionRow = ReturnType<ReturnType<typeof storedSessionQuery>['all']>[number]

function sessionListRows(
  context: SessionListContext,
  stored: readonly StoredSessionRow[],
): z.infer<typeof sessionListRowSchema>[] {
  const subagents = storedSessionSubagents(
    context.database,
    stored.map((row) => row.id),
  )
  return stored.map((row) => sessionListRow(context, row, subagents.get(row.id) ?? []))
}

async function readSessionRow(
  context: SessionListContext,
  sessionId: string,
): Promise<z.infer<typeof sessionListRowSchema> | null> {
  const link = context.database
    .select({ projectId: sessionTicketLink.projectId })
    .from(sessionTicketLink)
    .where(eq(sessionTicketLink.sessionId, sessionId))
    .get()
  const source = link === undefined ? null : await linkedTicketSource(context, link.projectId)
  const where = eq(sessionTable.argoId, sessionId)
  return (
    sessionListRows(context, storedSessionQuery(context.database, where, source).all())[0] ?? null
  )
}

async function readSessionList(
  context: SessionListContext,
  input: z.infer<typeof sessionListInputSchema>,
): Promise<z.infer<typeof sessionListSchema>> {
  const source = await linkedTicketSource(context, input.projectId)
  const filters = {
    active: isNull(sessionArchive.sessionId),
    archived: isNotNull(sessionArchive.sessionId),
    all: undefined,
  } as const satisfies Record<typeof input.filter, SQL | undefined>
  const where = and(
    eq(sessionTable.projectId, input.projectId),
    filters[input.filter],
    input.ticketKey === undefined
      ? undefined
      : and(
          eq(sessionTicketLink.projectId, input.projectId),
          eq(sessionTicketLink.ticketKey, input.ticketKey),
        ),
    input.search === ''
      ? undefined
      : sql<boolean>`instr(lower(${shownName}), lower(${input.search})) > 0`,
  )
  // A Ticket's Sessions read most recently linked first.
  const order =
    input.ticketKey === undefined
      ? sessionListOrder
      : [desc(sessionTicketLink.createdAt), ...sessionListOrder]
  const stored = storedSessionQuery(context.database, where, source)
    .orderBy(...order)
    .limit(input.limit)
    .offset(input.offset)
    .all()
  // A page past the end has no row to carry the count.
  const total =
    stored[0]?.total ??
    (input.offset === 0
      ? 0
      : (context.database
          .select({ value: count() })
          .from(storedSessionQuery(context.database, where, source).as('listed'))
          .get()?.value ?? 0))
  return { total, rows: sessionListRows(context, stored) }
}

export function sessionListProcedure(context: SessionListContext) {
  return t.procedure
    .input(sessionListInputSchema)
    .output(sessionListSchema)
    .query(({ input }) => readSessionList(context, input))
}

// Stored facts come from SQLite and connection facts from the live supervisor; no history is read.
export function sessionDetailsProcedure(context: SessionListContext) {
  return t.procedure
    .input(z.strictObject({ sessionId: identifierSchema }))
    .output(sessionListRowSchema.nullable())
    .query(({ input }) => readSessionRow(context, input.sessionId))
}

// Announces the saved Sessions a write or a live status changed; each Session List reads them again.
export function sessionListChangedProcedure(context: SessionListContext) {
  return t.procedure.subscription(() =>
    observable<{ sessionIds: string[] }>((emit) =>
      context.changes.subscribe((sessionIds) => emit.next({ sessionIds: [...sessionIds] })),
    ),
  )
}

// Announces each live status change, so every Session List reads the changed row again, and saves
// the live channel's Model, Effort and Mode, so the row keeps them once the channel is gone.
export function watchSessionList(
  context: Pick<SessionListContext, 'database' | 'supervisor' | 'changes'>,
): () => void {
  const statusChanges = context.supervisor.on('Session status changed', ({ sessionId }) => {
    const live = liveProjection(context, sessionId)
    if (live !== null)
      updateSession(context, sessionId, { turnConfiguration: live.turnConfiguration })
    context.changes.changed([sessionId])
  })
  return () => statusChanges.unsubscribe()
}
