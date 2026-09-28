import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { type Database, openDatabase } from '@/database/database'
import { sessionCommandTable } from '@/database/session-command/schema'
import { scanRollouts } from '../../../../../mocks/cli/codex/mock-codex-rollout-history'
import type { CodexRequest } from '@/harnesses/codex/app-server/codex-app-server-client'
import { hasCodexSessionTurn } from '@/harnesses/codex/session/codex-session-history'
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
let directory: string
let database: Database

beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'argo-command-outcome-'))
  database = openDatabase(directory)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  database.$client.close()
  await rm(directory, { recursive: true, force: true })
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
  bindSessionCommand(database, command.commandId, { nativeId: 'native-1', sessionId: 'session-1' })
  setSessionCommandOutcome(database, command.commandId, 'observed')
  setSessionCommandOutcome(database, command.commandId, 'completed')
  expect(claimSessionCommand(database, command)).toEqual({
    claimed: false,
    sessionId: 'session-1',
  })
  expect(storedOutcome()).toMatchObject({ outcome: 'completed', nativeId: 'native-1' })
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
  vi.stubEnv(
    'ARGO_CODEX_TRANSCRIPTS',
    fileURLToPath(new URL('../../../../../mocks/cli/codex/fixtures/sessions', import.meta.url)),
  )
  const thread = scanRollouts().find((candidate) => candidate.id === 'rollout-codexChild')
  const turnId = thread?.turns[0]?.id
  if (thread === undefined || turnId === undefined) throw new Error('Recorded Codex turn missing.')
  const codexCommand = { ...command, harness: 'codex' as const, nativeId: thread.id }
  claimSessionCommand(database, codexCommand)
  bindSessionCommand(database, command.commandId, { sessionId: 'session-1', turnId })
  setSessionCommandOutcome(database, command.commandId, 'observed')
  markUnresolvedSessionCommandsUnknown(database)
  expect(storedOutcome()?.outcome).toBe('unknown')
  expect(() => claimSessionCommand(database, codexCommand)).toThrow(/uncertain/)
  const reads: string[] = []
  await reconcileUnknownSessionCommands(database, async (harness, target) => {
    reads.push(`${harness}:${target.nativeId}`)
    return []
  }, async (harness, nativeId, lookupTurnId) => {
    expect(harness).toBe('codex')
    const request = (async (_method: string, _params: unknown, parse: (value: unknown) => unknown) =>
      parse({ thread })) as CodexRequest
    return hasCodexSessionTurn(request, nativeId, lookupTurnId)
  })
  expect(reads).toEqual(['codex:rollout-codexChild'])
  expect(storedOutcome()?.outcome).toBe('observed')
  expect(claimSessionCommand(database, codexCommand).claimed).toBe(false)
})

test('an unresolved start without a native ID cannot be sent with another command ID', async () => {
  claimSessionCommand(database, command)
  markUnresolvedSessionCommandsUnknown(database)
  let reads = 0
  await reconcileUnknownSessionCommands(database, async () => {
    reads += 1
    return []
  }, async () => false)
  expect(reads).toBe(0)
  expect(() =>
    claimSessionCommand(database, {
      ...command,
      commandId: '00000000-0000-4000-8000-000000000002',
    }),
  ).toThrow(/different command/)
  expect(storedOutcome()?.outcome).toBe('unknown')
})

test('an unavailable vendor read preserves the unknown outcome', async () => {
  claimSessionCommand(database, { ...command, nativeId: 'native-1' })
  markUnresolvedSessionCommandsUnknown(database)
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    await reconcileUnknownSessionCommands(database, async () => {
      throw new Error('offline')
    }, async () => false)
  } finally {
    console.warn = originalWarn
  }
  expect(storedOutcome()?.outcome).toBe('unknown')
})
