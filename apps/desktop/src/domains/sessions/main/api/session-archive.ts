import { initTRPC } from '@trpc/server'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { identifierSchema } from '@/shared/validation'
import { rowsForSessionIds, type SessionListContext } from './session-list'

const t = initTRPC.create()
const PAGE_SIZE = 20
const listInputSchema = z.strictObject({
  projectId: identifierSchema,
  cursor: z.string().regex(/^\d+$/).nullable(),
  restoreId: identifierSchema.nullable(),
})
const setInputSchema = z.strictObject({
  sessionIds: z.array(identifierSchema),
  archived: z.boolean(),
})

function pageOffset(cursor: string | null) {
  return cursor === null ? 0 : Number(cursor)
}

export function sessionArchiveProcedures(context: SessionListContext) {
  return {
    sessionArchiveList: t.procedure.input(listInputSchema).query(({ input }) => {
      const archived = context.database
        .select({ sessionId: sessionArchive.sessionId })
        .from(sessionArchive)
        .all()
      const rows = rowsForSessionIds(
        context,
        input.projectId,
        archived.map((row) => row.sessionId),
      ).sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))
      const offset = pageOffset(input.cursor)
      const sessions = rows.slice(offset, offset + PAGE_SIZE)
      const next = offset + PAGE_SIZE
      return {
        sessions,
        nextCursor: next < rows.length ? String(next) : null,
        restored:
          input.restoreId === null
            ? null
            : (rows.find((row) => row.id === input.restoreId) ?? null),
        historyComplete: true,
      }
    }),
    sessionArchiveSet: t.procedure.input(setInputSchema).mutation(({ input }) => {
      const known = new Set(
        context.database
          .select({ id: sessionTable.argoId })
          .from(sessionTable)
          .where(inArray(sessionTable.argoId, input.sessionIds))
          .all()
          .map((row) => row.id),
      )
      const applied: string[] = []
      const failed: string[] = []
      for (const sessionId of input.sessionIds) {
        if (!known.has(sessionId)) {
          failed.push(sessionId)
          continue
        }
        if (input.archived) {
          context.database.insert(sessionArchive).values({ sessionId }).onConflictDoNothing().run()
        } else {
          context.database
            .delete(sessionArchive)
            .where(eq(sessionArchive.sessionId, sessionId))
            .run()
        }
        applied.push(sessionId)
      }
      if (applied.length > 0) context.roster.changed()
      return { applied, failed }
    }),
  }
}
