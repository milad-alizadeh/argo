import { initTRPC } from '@trpc/server'
import { count, desc, eq } from 'drizzle-orm'
import {
  sessionDetailInputSchema,
  sessionDetailOutputSchema,
} from '@/domains/sessions/contract/session-detail'
import {
  sessionListInputSchema,
  sessionListOutputSchema,
} from '@/domains/sessions/contract/session-list'
import {
  type SessionStartInput,
  type SessionStartOutput,
  sessionStartInputSchema,
  sessionStartOutputSchema,
} from '@/domains/sessions/contract/session-start'
import type { SessionIdentity } from '@/domains/sessions/next/contract/session-contract'
import { harnessSchema } from '@/domains/sessions/next/contract/session-contract'
import { session } from '@/domains/sessions/next/main/schema'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

export type SessionRouterContext = {
  database: DurableDatabase
  selectedProjectId?: () => string | null
  startSession?: (input: SessionStartInput) => Promise<SessionStartOutput>
  hasLiveChannel?: (session: SessionIdentity) => boolean
}

const t = initTRPC.context<SessionRouterContext>().create()

export const sessionRouter = t.router({
  detail: t.procedure
    .input(sessionDetailInputSchema)
    .output(sessionDetailOutputSchema)
    .query(({ ctx, input }) => {
      const row = ctx.database.select().from(session).where(eq(session.argoId, input.argoId)).get()
      if (row === undefined) return null
      const harness = harnessSchema.parse(row.harness)
      return {
        argoId: row.argoId,
        harness,
        title: row.title,
        firstPrompt: row.firstPrompt,
        posture: ctx.hasLiveChannel?.({ harness, nativeId: row.nativeId }) ? 'managed' : 'watched',
      }
    }),
  start: t.procedure
    .input(sessionStartInputSchema)
    .output(sessionStartOutputSchema)
    .mutation(({ ctx, input }) => {
      if (ctx.startSession === undefined) throw new Error('Session starter is unavailable')
      return ctx.startSession(input)
    }),
  list: t.procedure
    .input(sessionListInputSchema)
    .output(sessionListOutputSchema)
    .query(({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      const selectedProjectId = ctx.selectedProjectId?.()
      if (!selectedProjectId) return { ...input, total: 0, items: [] }
      const projectFilter = eq(session.projectId, selectedProjectId)
      const rows = ctx.database
        .select({
          argoId: session.argoId,
          harness: session.harness,
          title: session.title,
        })
        .from(session)
        .where(projectFilter)
        .orderBy(desc(session.updatedAt), desc(session.argoId))
        .limit(input.pageSize)
        .offset(offset)
        .all()
      const items = rows.map((row) => ({ ...row, harness: harnessSchema.parse(row.harness) }))
      const total =
        ctx.database.select({ total: count() }).from(session).where(projectFilter).get()?.total ?? 0
      return { ...input, total, items }
    }),
})
