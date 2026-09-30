import { initTRPC } from '@trpc/server'
import { and, asc, desc, eq, inArray, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { sessionTable } from '@/database/session/schema'
import { sessionArchive } from '@/database/session-archive/schema'
import { identifierSchema } from '@/shared/validation'
import { storedSessionSubagents } from '../database/session-subagents'
import { type SessionListContext, sessionListRow, storedSessionRows } from './session-list'

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

// The row's shown time, newest first, with the Argo ID breaking ties.
const archiveOrderAt = sql<number>`coalesce(${sessionTable.activityAt}, ${sessionTable.updatedAt})`

function archivedRows(
  context: SessionListContext,
  filter: SQL | undefined,
  { limit, offset }: { limit: number; offset: number },
) {
  const stored = storedSessionRows(context.database)
    .innerJoin(sessionArchive, eq(sessionArchive.sessionId, sessionTable.argoId))
    .where(filter)
    .orderBy(desc(archiveOrderAt), asc(sessionTable.argoId))
    .limit(limit)
    .offset(offset)
    .all()
  const subagents = storedSessionSubagents(
    context.database,
    stored.map((row) => row.id),
  )
  return stored.map((row) =>
    sessionListRow(context, { ...row, archived: true }, subagents.get(row.id) ?? []),
  )
}

export function sessionArchiveProcedures(context: SessionListContext) {
  return {
    sessionArchiveList: t.procedure.input(listInputSchema).query(({ input }) => {
      const inProject = eq(sessionTable.projectId, input.projectId)
      const offset = input.cursor === null ? 0 : Number(input.cursor)
      const page = archivedRows(context, inProject, { limit: PAGE_SIZE + 1, offset })
      return {
        sessions: page.slice(0, PAGE_SIZE),
        nextCursor: page.length > PAGE_SIZE ? String(offset + PAGE_SIZE) : null,
        restored:
          input.restoreId === null
            ? null
            : (archivedRows(context, and(inProject, eq(sessionTable.argoId, input.restoreId)), {
                limit: 1,
                offset: 0,
              })[0] ?? null),
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
      if (applied.length > 0) context.roster.changed('membership')
      return { applied, failed }
    }),
  }
}
