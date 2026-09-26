import { initTRPC } from '@trpc/server'
import { asc, count } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import type { LiveSessionSupervisorActor } from '../live/live-session-supervisor-machine'

const t = initTRPC.create()

export const sessionListInputSchema = z.strictObject({
  page: z.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
})

const sessionListTitleSchema = z.strictObject({
  text: z.string(),
  source: z.enum(['custom', 'summarised', 'first-prompt']),
})

export const sessionListRowSchema = z.strictObject({
  id: z.string().uuid(),
  retiredIds: z.array(z.string().uuid()),
  harness: z.string().min(1),
  posture: z.literal('live').nullable(),
  title: sessionListTitleSchema.nullable(),
  status: z.enum(['running', 'idle', 'stopped', 'ended', 'unknown']),
  entry: z.null(),
  cwd: z.string().nullable(),
  branch: z.null(),
  updatedAt: z.string().datetime(),
  unreadableLines: z.literal(0),
  originUnread: z.literal(false),
  turnStartedAt: z.null(),
  activity: z.null(),
  plan: z.null(),
  subagents: z.array(z.never()),
  shell: z.array(z.never()),
  pullRequest: z.null(),
  ticket: z.null(),
  archived: z.literal(false),
  unread: z.literal(false),
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
  let status: 'running' | 'idle' | 'stopped' | 'ended'
  if (snapshot.matches('Ready')) status = 'idle'
  else if (snapshot.matches('Failed')) status = 'stopped'
  else if (snapshot.matches('Closed')) status = 'ended'
  else status = 'running'
  return {
    posture: 'live' as const,
    status,
    turnConfiguration: snapshot.context.first.turnConfiguration,
  }
}

function displayedTitle(row: StoredSessionTitle): z.infer<typeof sessionListTitleSchema> | null {
  if (row.customTitle !== null) return { text: row.customTitle, source: 'custom' }
  if (row.preview !== null) return { text: row.preview, source: 'summarised' }
  if (row.firstPrompt !== null) return { text: row.firstPrompt, source: 'first-prompt' }
  return null
}

export function sessionListProcedure(context: SessionListContext) {
  return t.procedure
    .input(sessionListInputSchema)
    .output(sessionListOutputSchema)
    .query(({ input }) => {
      const storedRows = context.database
        .select({
          id: sessionTable.argoId,
          harness: sessionTable.harness,
          customTitle: sessionTable.customTitle,
          preview: sessionTable.preview,
          firstPrompt: sessionTable.firstPrompt,
          cwd: sessionTable.cwd,
          updatedAt: sessionTable.updatedAt,
        })
        .from(sessionTable)
        .orderBy(asc(sessionTable.argoId))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize)
        .all()
      const total = context.database.select({ value: count() }).from(sessionTable).get()?.value ?? 0
      return {
        page: input.page,
        pageSize: input.pageSize,
        total,
        rows: storedRows.map((row) => {
          const live = liveProjection(context, row.id)
          return {
            id: row.id,
            retiredIds: [],
            harness: row.harness,
            posture: live?.posture ?? null,
            title: displayedTitle(row),
            status: live?.status ?? ('unknown' as const),
            entry: null,
            cwd: row.cwd,
            branch: null,
            updatedAt: new Date(row.updatedAt).toISOString(),
            unreadableLines: 0 as const,
            originUnread: false as const,
            turnStartedAt: null,
            activity: null,
            plan: null,
            subagents: [],
            shell: [],
            pullRequest: null,
            ticket: null,
            archived: false as const,
            unread: false as const,
            turnConfiguration: live?.turnConfiguration ?? { model: null, effort: null, mode: null },
          }
        }),
      }
    })
}
