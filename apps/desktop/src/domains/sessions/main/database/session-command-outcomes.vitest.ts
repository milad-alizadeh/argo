import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { Database } from '@/database/database'
import { sessionCommandTable } from '@/database/session/command-schema'
import { hasCodexSessionTurn } from '@/harnesses/codex/session'
import { recordedThread, recordedThreadRequest } from '@/mocks/cli/codex/recorded-codex-threads'
import { RECORDED_PROMPTS } from '@/mocks/cli/recorded-prompts'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import {
  bindSessionCommand,
  claimSessionCommand,
  markUnresolvedSessionCommandsUnknown,
  reconcileUnknownSessionCommands,
  setSessionCommandOutcome,
} from './session-command-outcomes'

const command = {
  commandId: '00000000-0000-4000-8000-000000000001',
  intentId: 'optimistic:draft-1:1',
  sessionId: null,
  harness: 'claude' as const,
  nativeId: null,
  cwd: '/project',
}
let database: Database

beforeEach(() => {
  database = migratedDatabase()
})

afterEach(() => {
  database.$client.close()
})

function storedOutcome() {
  return database
    .select()
    .from(sessionCommandTable)
    .where(eq(sessionCommandTable.commandId, command.commandId))
    .get()
}

test('records only command control facts and prevents a duplicate vendor call', () => {
  expect(claimSessionCommand(database, command)).toEqual({ claimed: true, sessionId: null })
  bindSessionCommand(database, command.commandId, { nativeId: 'native-1' })
  setSessionCommandOutcome(database, command.commandId, 'observed')
  setSessionCommandOutcome(database, command.commandId, 'completed')
  expect(claimSessionCommand(database, command)).toEqual({
    claimed: false,
    sessionId: null,
  })
  expect(storedOutcome()).toMatchObject({ status: 'completed', nativeId: 'native-1' })
  expect(database.$client.prepare('SELECT COUNT(*) AS count FROM session_command').get()).toEqual({
    count: 1,
  })
  const columns = database.$client.prepare('PRAGMA table_info(session_command)').all() as Array<{
    name: string
  }>
  expect(columns.map(({ name }) => name)).not.toContain('prompt')
  expect(columns.map(({ name }) => name)).not.toContain('event_payload')
})

test('restart checks a recorded Codex turn before resolving an uncertain send', async () => {
  const thread = recordedThread(RECORDED_PROMPTS.codexReply)
  const turnId = thread.turns[0]?.id
  if (turnId === undefined) throw new Error('Recorded Codex turn missing.')
  const codexCommand = { ...command, harness: 'codex' as const, nativeId: thread.id }
  claimSessionCommand(database, codexCommand)
  bindSessionCommand(database, command.commandId, { turnId })
  setSessionCommandOutcome(database, command.commandId, 'observed')
  markUnresolvedSessionCommandsUnknown(database)
  expect(storedOutcome()?.status).toBe('uncertain')
  expect(() => claimSessionCommand(database, codexCommand)).toThrow(/uncertain/)
  const reads: string[] = []
  await reconcileUnknownSessionCommands(
    database,
    async (harness, target) => {
      reads.push(`${harness}:${target.nativeId}`)
      throw new Error('Projection unavailable')
    },
    async (harness, nativeId, lookupTurnId) => {
      expect(harness).toBe('codex')
      return hasCodexSessionTurn(recordedThreadRequest(thread), nativeId, lookupTurnId)
    },
  )
  expect(reads).toEqual([])
  expect(storedOutcome()?.status).toBe('running')
  expect(claimSessionCommand(database, codexCommand).claimed).toBe(false)
})

test('an unresolved start without a native ID cannot be sent with another command ID', async () => {
  claimSessionCommand(database, command)
  markUnresolvedSessionCommandsUnknown(database)
  let reads = 0
  await reconcileUnknownSessionCommands(
    database,
    async () => {
      reads += 1
      return []
    },
    async () => false,
  )
  expect(reads).toBe(0)
  expect(() =>
    claimSessionCommand(database, {
      ...command,
      commandId: '00000000-0000-4000-8000-000000000002',
    }),
  ).toThrow(/different command/)
  expect(storedOutcome()?.status).toBe('uncertain')
})

test('an unavailable vendor read preserves the unknown outcome', async () => {
  claimSessionCommand(database, { ...command, nativeId: 'native-1' })
  markUnresolvedSessionCommandsUnknown(database)
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    await reconcileUnknownSessionCommands(
      database,
      async () => {
        throw new Error('offline')
      },
      async () => false,
    )
  } finally {
    console.warn = originalWarn
  }
  expect(storedOutcome()?.status).toBe('uncertain')
})
