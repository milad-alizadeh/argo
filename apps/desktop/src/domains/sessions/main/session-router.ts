import { initTRPC } from '@trpc/server'
import { asc, count } from 'drizzle-orm'
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
      const rows = ctx.database
        .select({
          argoId: session.argoId,
          harness: session.harness,
          nativeId: session.nativeId,
          title: session.title,
        })
        .from(session)
        .orderBy(asc(session.updatedAt), asc(session.argoId))
        .limit(input.pageSize)
        .offset(offset)
        .all()
      const items = rows.map((row) => ({ ...row, harness: harnessSchema.parse(row.harness) }))
      const total = ctx.database.select({ total: count() }).from(session).get()?.total ?? 0
      return { ...input, total, items }
    }),
})
