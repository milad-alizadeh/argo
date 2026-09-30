import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionTable } from '@/database/session/schema'
import { harnessSchema } from '@/harnesses/harness'

export function sessionHistoryIdentity(database: Database, sessionId: string) {
  const stored = database
    .select({
      harness: sessionTable.harness,
      nativeId: sessionTable.nativeId,
      cwd: sessionTable.cwd,
    })
    .from(sessionTable)
    .where(eq(sessionTable.argoId, sessionId))
    .get()
  if (stored === undefined) throw new TRPCError({ code: 'NOT_FOUND', message: 'missing-session' })
  return { ...stored, harness: harnessSchema.parse(stored.harness) }
}
