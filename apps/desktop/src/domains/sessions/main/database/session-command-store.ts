import { and, eq, ne } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionCommandTable } from '@/database/session/command-schema'

export type CommandStatus = typeof sessionCommandTable.$inferSelect.status

export function createSessionCommandStore(database: Database) {
  return {
    reserve(commandId: string, sessionId: string | null) {
      const inserted = database
        .insert(sessionCommandTable)
        .values({ commandId, sessionId, status: 'queued' })
        .onConflictDoNothing()
        .returning({ commandId: sessionCommandTable.commandId })
        .get()
      if (inserted !== undefined) return { reserved: true as const, sessionId }
      const existing = database
        .select({
          sessionId: sessionCommandTable.sessionId,
          status: sessionCommandTable.status,
        })
        .from(sessionCommandTable)
        .where(eq(sessionCommandTable.commandId, commandId))
        .get()
      if (existing === undefined) throw new Error('Session command disappeared after reservation.')
      return { reserved: false as const, ...existing }
    },
    bind(commandId: string, sessionId: string) {
      database
        .update(sessionCommandTable)
        .set({ sessionId, updatedAt: Date.now() })
        .where(eq(sessionCommandTable.commandId, commandId))
        .run()
    },
    record(commandId: string, status: CommandStatus) {
      database
        .update(sessionCommandTable)
        .set({ status, updatedAt: Date.now() })
        .where(
          status === 'completed'
            ? eq(sessionCommandTable.commandId, commandId)
            : and(
                eq(sessionCommandTable.commandId, commandId),
                ne(sessionCommandTable.status, 'completed'),
              ),
        )
        .run()
    },
  }
}

export type SessionCommandStore = ReturnType<typeof createSessionCommandStore>
