import { eq } from 'drizzle-orm'
import type { Database } from '@/database/database'
import { sessionCommandTable } from '@/database/session/command-schema'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { type CommandStatus, createSessionCommandStore } from './session-command-store'

type CommandOutcome = 'queued' | 'accepted' | 'observed' | 'completed' | 'unknown'
const outcomeStatus: Record<CommandOutcome, CommandStatus> = {
  queued: 'queued',
  accepted: 'accepted',
  observed: 'running',
  completed: 'completed',
  unknown: 'uncertain',
}
type CommandIdentity = {
  commandId: string
  intentId: string
  sessionId: string | null
  harness: Harness
  nativeId: string | null
  cwd: string
}

export function claimSessionCommand(database: Database, input: CommandIdentity) {
  const result = createSessionCommandStore(database).reserve(input.commandId, input.sessionId, {
    intentId: input.intentId,
    harness: input.harness,
    nativeId: input.nativeId,
    cwd: input.cwd,
  })
  return { claimed: result.reserved, sessionId: result.sessionId }
}

export function bindSessionCommand(
  database: Database,
  commandId: string,
  identity: { sessionId?: string; nativeId?: string; turnId?: string },
): void {
  const store = createSessionCommandStore(database)
  if (identity.sessionId !== undefined) store.bind(commandId, identity.sessionId)
  if (identity.nativeId !== undefined || identity.turnId !== undefined)
    store.bindIdentity(commandId, identity)
}

export function setSessionCommandOutcome(
  database: Database,
  commandId: string,
  outcome: CommandOutcome,
): void {
  createSessionCommandStore(database).record(commandId, outcomeStatus[outcome])
}

export function markUnresolvedSessionCommandsUnknown(database: Database): void {
  createSessionCommandStore(database).markUnresolvedUncertain()
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
    .where(eq(sessionCommandTable.status, 'uncertain'))
    .all()
  let invalid = 0
  for (const command of uncertain) {
    if (command.nativeId === null) continue
    const harness = harnessSchema.safeParse(command.harness)
    if (!harness.success || command.cwd === null) {
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
