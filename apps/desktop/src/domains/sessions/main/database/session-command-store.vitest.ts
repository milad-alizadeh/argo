import { expect, test } from 'vitest'
import { sessionTable } from '@/database/session/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { createSessionCommandStore } from './session-command-store'

test('reserves a command once and retains its bound Session and outcome', () => {
  const database = migratedDatabase()
  database
    .insert(sessionTable)
    .values({ argoId: 'argo-1', harness: 'codex', nativeId: 'native-1' })
    .run()
  const commands = createSessionCommandStore(database)
  expect(commands.reserve('command-1', null)).toEqual({ reserved: true, sessionId: null })
  expect(commands.reserve('command-1', null)).toEqual({
    reserved: false,
    sessionId: null,
    status: 'queued',
  })
  commands.record('command-1', 'running')
  commands.bind('command-1', 'argo-1')
  expect(commands.reserve('command-1', null)).toEqual({
    reserved: false,
    sessionId: 'argo-1',
    status: 'running',
  })
  commands.record('command-1', 'uncertain')
  commands.record('command-1', 'accepted')
  expect(commands.reserve('command-1', null)).toMatchObject({ status: 'uncertain' })
  commands.record('command-1', 'running')
  commands.record('command-1', 'completed')
  commands.record('command-1', 'uncertain')
  expect(commands.reserve('command-1', null)).toMatchObject({ status: 'completed' })
  database.$client.close()
})
