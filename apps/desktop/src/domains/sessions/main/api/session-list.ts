import { initTRPC } from '@trpc/server'
import { and, asc, count, desc, eq, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { sessionTicketLink } from '@/database/session-ticket-link/schema'
import { sessionTitleSchema } from '@/domains/sessions/api/session-title'
import type { LiveSessionSupervisorActor } from '../live/live-session-supervisor-machine'

const t = initTRPC.create()

export const sessionListInputSchema = z.strictObject({
  projectId: z.string().min(1),
  search: z.string().trim().max(500).default(''),
  // tRPC's generated infinite-query options reserve `cursor` and `direction`. This list uses
  // numbered SQL pages, so the cursor is the next page number rather than an opaque database key.
  cursor: z.number().int().min(1).max(1_000_000).nullable().optional(),
  direction: z.enum(['forward', 'backward']).optional(),
  page: z.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
})

const identifierSchema = z.string().min(1)
const countSchema = z.number().int().nonnegative()
const sessionActivitySchema = z.strictObject({
  label: z.string(),
  kind: z.enum([
    'command',
    'read',
    'edited',
    'created',
    'deleted',
    'tool',
    'skill',
    'searched',
    'thought',
  ]),
  open: z.boolean(),
  tool: z.string(),
  target: z.string().nullable(),
})
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
  entry: z.enum(['interactive', 'headless']).nullable(),
  cwd: z.string().nullable(),
  branch: z.string().nullable(),
  locked: z.boolean().optional(),
  updatedAt: z.string().nullable(),
  unreadableLines: z.number(),
  originUnread: z.boolean(),
  turnStartedAt: z.string().nullable(),
  activity: sessionActivitySchema.nullable(),
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

export const sessionListOutputSchema = z.strictObject({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  rows: z.array(sessionListRowSchema),
})

type StoredSessionTitle = {
  customTitle: string | null
  preview: string | null
  firstPrompt: string | null
}

type SessionListContext = {
  database: Database
  supervisor: LiveSessionSupervisorActor
}

function liveProjection(context: SessionListContext, sessionId: string) {
  const actor = context.supervisor.getSnapshot().context.sessions[sessionId]
  if (actor === undefined) return null
  const snapshot = actor.getSnapshot()
  const stateProjection = {
    Starting: { posture: 'live', status: 'starting' },
    Persisting: { posture: 'live', status: 'starting' },
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
    ...projection,
    turnConfiguration: snapshot.context.first.turnConfiguration,
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
    cwd: string | null
    updatedAt: number
    ticket: {
      projectId: string
      key: string
      title: string
      state: string
      createdAt: string
    } | null
  },
) {
  const live = liveProjection(context, row.id)
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
    status: live?.status ?? ('unknown' as const),
    entry: null,
    cwd: row.cwd,
    branch: null,
    updatedAt: new Date(row.updatedAt).toISOString(),
    unreadableLines: 0,
    originUnread: false,
    turnStartedAt: null,
    activity: null,
    plan: null,
    subagents: [],
    shell: [],
    pullRequest: null,
    ticket,
    archived: false,
    unread: false,
    turnConfiguration: live?.turnConfiguration ?? { model: null, effort: null, mode: null },
  }
}

function readSessionList(
  context: SessionListContext,
  input: z.infer<typeof sessionListInputSchema>,
) {
  const page = input.cursor ?? input.page
  const projectFilter = eq(sessionTable.projectId, input.projectId)
  const filter =
    input.search === ''
      ? projectFilter
      : and(
          projectFilter,
          or(
            sql<boolean>`instr(lower(coalesce(${sessionTable.customTitle}, '')), lower(${input.search})) > 0`,
            sql<boolean>`instr(lower(coalesce(${sessionTable.preview}, '')), lower(${input.search})) > 0`,
          ),
        )
  const rows = context.database
    .select({
      id: sessionTable.argoId,
      harness: sessionTable.harness,
      customTitle: sessionTable.customTitle,
      preview: sessionTable.preview,
      firstPrompt: sessionTable.firstPrompt,
      cwd: sessionTable.cwd,
      updatedAt: sessionTable.updatedAt,
      ticket: {
        projectId: sessionTicketLink.projectId,
        key: sessionTicketLink.ticketKey,
        title: sessionTicketLink.title,
        state: sessionTicketLink.state,
        createdAt: sessionTicketLink.createdAt,
      },
    })
    .from(sessionTable)
    .leftJoin(sessionTicketLink, eq(sessionTicketLink.sessionId, sessionTable.argoId))
    .where(filter)
    .orderBy(desc(sessionTable.updatedAt), asc(sessionTable.argoId))
    .limit(input.pageSize)
    .offset((page - 1) * input.pageSize)
    .all()
    .map((row) => sessionListRow(context, row))
  const total =
    context.database.select({ value: count() }).from(sessionTable).where(filter).get()?.value ?? 0
  return { page, pageSize: input.pageSize, total, rows }
}

export function sessionListProcedure(context: SessionListContext) {
  return t.procedure
    .input(sessionListInputSchema)
    .output(sessionListOutputSchema)
    .query(({ input }) => readSessionList(context, input))
}
