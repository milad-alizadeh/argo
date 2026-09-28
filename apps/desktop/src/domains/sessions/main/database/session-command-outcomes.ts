import { eq, inArray, or } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionCommandTable } from '@/database/session-command/schema'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { type Harness, harnessSchema } from '@/harnesses/harness'

type CommandOutcome = 'queued' | 'accepted' | 'observed' | 'completed' | 'unknown'
type CommandIdentity = {
  commandId: string
  intentId: string
  sessionId: string | null
  harness: Harness
  nativeId: string | null
  cwd: string
}

export function claimSessionCommand(database: Database, input: CommandIdentity) {
  const prior = database
    .select()
    .from(sessionCommandTable)
    .where(
      or(
        eq(sessionCommandTable.commandId, input.commandId),
        eq(sessionCommandTable.intentId, input.intentId),
      ),
    )
    .get()
  if (prior !== undefined) {
    if (prior.commandId !== input.commandId || prior.intentId !== input.intentId)
      throw new Error('A different command already used this draft or command ID.')
    if (prior.outcome === 'unknown')
      throw new Error('The previous send is uncertain. Read vendor history before retrying.')
    return { claimed: false, sessionId: prior.sessionId }
  }
  database.insert(sessionCommandTable).values({ ...input, outcome: 'queued' }).run()
  return { claimed: true, sessionId: input.sessionId }
}

export function bindSessionCommand(
  database: Database,
  commandId: string,
  identity: { sessionId?: string; nativeId?: string; turnId?: string },
): void {
  database
    .update(sessionCommandTable)
    .set({ ...identity, updatedAt: Date.now() })
    .where(eq(sessionCommandTable.commandId, commandId))
    .run()
}

export function setSessionCommandOutcome(
  database: Database,
  commandId: string,
  outcome: CommandOutcome,
): void {
  const prior = database
    .select({ outcome: sessionCommandTable.outcome })
    .from(sessionCommandTable)
    .where(eq(sessionCommandTable.commandId, commandId))
    .get()
  if (prior === undefined || prior.outcome === 'completed') return
  if (
    (prior.outcome === 'accepted' && outcome === 'queued') ||
    (prior.outcome === 'observed' && (outcome === 'queued' || outcome === 'accepted'))
  )
    return
  database
    .update(sessionCommandTable)
    .set({ outcome, updatedAt: Date.now() })
    .where(eq(sessionCommandTable.commandId, commandId))
    .run()
}

export function markUnresolvedSessionCommandsUnknown(database: Database): void {
  database
    .update(sessionCommandTable)
    .set({ outcome: 'unknown', updatedAt: Date.now() })
    .where(inArray(sessionCommandTable.outcome, ['queued', 'accepted', 'observed']))
    .run()
}

export async function reconcileUnknownSessionCommands(
  database: Database,
  readHistory: (
    harness: Harness,
    target: { nativeId: string; subagentId: null; cwd: string },
  ) => Promise<FeedContent[]>,
  hasTurn: (harness: Harness, nativeId: string, turnId: string) => Promise<boolean>,
): Promise<void> {
  const uncertain = database
    .select()
    .from(sessionCommandTable)
    .where(eq(sessionCommandTable.outcome, 'unknown'))
    .all()
  let invalid = 0
  for (const command of uncertain) {
    if (command.nativeId === null) continue
    const harness = harnessSchema.safeParse(command.harness)
    if (!harness.success) {
      invalid += 1
      continue
    }
    try {
      const history = await readHistory(harness.data, {
        nativeId: command.nativeId,
        subagentId: null,
        cwd: command.cwd,
      })
      if (
        (command.turnId !== null &&
          (await hasTurn(harness.data, command.nativeId, command.turnId))) ||
        history.some(
          (item) =>
            item.kind === 'message' && item.role === 'user' && item.id === command.commandId,
        )
      )
        setSessionCommandOutcome(database, command.commandId, 'observed')
    } catch (error) {
      console.warn('Session command history reconciliation failed.', error)
    }
  }
  if (invalid > 0) console.warn(`Skipped ${invalid} invalid stored Session command(s).`)
}
