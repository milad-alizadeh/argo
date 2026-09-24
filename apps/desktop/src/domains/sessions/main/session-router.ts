import { initTRPC } from '@trpc/server'
import { count, desc, eq } from 'drizzle-orm'
import { projectSelection } from '@/domains/projects/main/schema'
import {
  sessionPageInputSchema,
  sessionPageOutputSchema,
} from '@/domains/sessions/contract/session-page'
import { harnessSchema } from '@/domains/sessions/next/contract/session-contract'
import { session } from '@/domains/sessions/next/main/schema'
import type { DurableDatabase } from '@/platform/main/storage/durable-database'

export type SessionRouterContext = { database: DurableDatabase }

const t = initTRPC.context<SessionRouterContext>().create()

export const sessionRouter = t.router({
  page: t.procedure
    .input(sessionPageInputSchema)
    .output(sessionPageOutputSchema)
    .query(({ ctx, input }) => {
      const offset = (input.page - 1) * input.pageSize
      const selectedProjectId = ctx.database
        .select({ projectId: projectSelection.projectId })
        .from(projectSelection)
        .where(eq(projectSelection.singleton, 1))
        .get()?.projectId
      if (!selectedProjectId) return { ...input, total: 0, items: [] }
      const projectFilter = eq(session.projectId, selectedProjectId)
      const rows = ctx.database
        .select({
          argoId: session.argoId,
          harness: session.harness,
          nativeId: session.nativeId,
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
