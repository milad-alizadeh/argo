import { and, eq, inArray, ne, or } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionCommandTable } from '@/database/session/command-schema'
import type { Harness } from '@/harnesses/harness'

export type CommandStatus = typeof sessionCommandTable.$inferSelect.status
export type CommandIdentity = {
  intentId: string
  harness: Harness
  nativeId: string | null
  cwd: string
}
type StoredCommand = typeof sessionCommandTable.$inferSelect

function existingCommand(database: Database, commandId: string, intentId?: string) {
  return database
    .select()
    .from(sessionCommandTable)
    .where(
      intentId === undefined
        ? eq(sessionCommandTable.commandId, commandId)
        : or(
            eq(sessionCommandTable.commandId, commandId),
            eq(sessionCommandTable.intentId, intentId),
          ),
    )
    .get()
}

function priorReservation(prior: StoredCommand, commandId: string, identity?: CommandIdentity) {
  if (
    prior.commandId !== commandId ||
    (identity !== undefined && prior.intentId !== null && prior.intentId !== identity.intentId)
  )
    throw new Error('A different command already used this draft or command ID.')
  if (identity !== undefined && prior.status === 'uncertain')
    throw new Error('The previous send is uncertain. Read vendor history before retrying.')
  return { reserved: false as const, sessionId: prior.sessionId, status: prior.status }
}

function reserveCommand(
  database: Database,
  input: { commandId: string; sessionId: string | null; identity?: CommandIdentity },
) {
  const { commandId, sessionId, identity } = input
  const prior = existingCommand(database, commandId, identity?.intentId)
  if (prior !== undefined) return priorReservation(prior, commandId, identity)
  const inserted = database
    .insert(sessionCommandTable)
    .values({ commandId, sessionId, status: 'queued', ...identity })
    .onConflictDoNothing()
    .returning({ commandId: sessionCommandTable.commandId })
    .get()
  if (inserted !== undefined) return { reserved: true as const, sessionId }
  const concurrent = existingCommand(database, commandId, identity?.intentId)
  if (concurrent === undefined) throw new Error('Session command disappeared after reservation.')
  return priorReservation(concurrent, commandId, identity)
}

function recordCommand(database: Database, commandId: string, status: CommandStatus) {
  const prior = existingCommand(database, commandId)
  if (prior === undefined || prior.status === 'completed') return
  if (
    (prior.status === 'running' && (status === 'queued' || status === 'accepted')) ||
    (prior.status === 'accepted' && status === 'queued') ||
    (prior.status === 'uncertain' && (status === 'queued' || status === 'accepted'))
  )
    return
  database
    .update(sessionCommandTable)
    .set({ status, updatedAt: Date.now() })
    .where(
      and(
        eq(sessionCommandTable.commandId, commandId),
        ne(sessionCommandTable.status, 'completed'),
      ),
    )
    .run()
}

export function createSessionCommandStore(database: Database) {
  return {
    reserve: (commandId: string, sessionId: string | null, identity?: CommandIdentity) =>
      reserveCommand(database, { commandId, sessionId, identity }),
    bind(commandId: string, sessionId: string) {
      database
        .update(sessionCommandTable)
        .set({ sessionId, updatedAt: Date.now() })
        .where(eq(sessionCommandTable.commandId, commandId))
        .run()
    },
    bindIdentity(commandId: string, identity: { nativeId?: string; turnId?: string }) {
      database
        .update(sessionCommandTable)
        .set({ ...identity, updatedAt: Date.now() })
        .where(eq(sessionCommandTable.commandId, commandId))
        .run()
    },
    record: (commandId: string, status: CommandStatus) =>
      recordCommand(database, commandId, status),
    markUnresolvedUncertain() {
      database
        .update(sessionCommandTable)
        .set({ status: 'uncertain', updatedAt: Date.now() })
        .where(inArray(sessionCommandTable.status, ['queued', 'accepted', 'running']))
        .run()
    },
  }
}

export type SessionCommandStore = ReturnType<typeof createSessionCommandStore>
