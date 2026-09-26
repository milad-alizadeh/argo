import { initTRPC } from '@trpc/server'
import { asc, count } from 'drizzle-orm'
import { z } from 'zod'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'

const t = initTRPC.create()

export const sessionListInputSchema = z.strictObject({
  page: z.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(30),
})

const sessionListTitleSchema = z.strictObject({
  text: z.string(),
  source: z.enum(['custom', 'vendor-preview', 'first-prompt']),
})

export const sessionListRowSchema = z.strictObject({
  id: z.string().uuid(),
  harness: z.string().min(1),
  title: sessionListTitleSchema.nullable(),
  cwd: z.string().nullable(),
  updatedAt: z.number().int().nonnegative(),
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

function displayedTitle(row: StoredSessionTitle): z.infer<typeof sessionListTitleSchema> | null {
  if (row.customTitle !== null) return { text: row.customTitle, source: 'custom' }
  if (row.preview !== null) return { text: row.preview, source: 'vendor-preview' }
  if (row.firstPrompt !== null) return { text: row.firstPrompt, source: 'first-prompt' }
  return null
}

export function sessionListProcedure(database: Database) {
  return t.procedure
    .input(sessionListInputSchema)
    .output(sessionListOutputSchema)
    .query(({ input }) => {
      const storedRows = database
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
      const total = database.select({ value: count() }).from(sessionTable).get()?.value ?? 0
      return {
        page: input.page,
        pageSize: input.pageSize,
        total,
        rows: storedRows.map((row) => ({
          id: row.id,
          harness: row.harness,
          title: displayedTitle(row),
          cwd: row.cwd,
          updatedAt: row.updatedAt,
        })),
      }
    })
}
