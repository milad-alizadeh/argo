import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { databaseFrom } from '@/database/database'
import { createSessionCommandStore } from './session-command-store'

test('reserves a command once and retains its bound Session and outcome', () => {
  const client = new DatabaseSync(':memory:')
  client.exec(
    "CREATE TABLE session (argo_id TEXT PRIMARY KEY); CREATE TABLE session_command (command_id TEXT PRIMARY KEY, session_id TEXT REFERENCES session(argo_id), status TEXT NOT NULL, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0); INSERT INTO session (argo_id) VALUES ('argo-1');",
  )
  const commands = createSessionCommandStore(databaseFrom(client))
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
  commands.record('command-1', 'completed')
  commands.record('command-1', 'uncertain')
  expect(commands.reserve('command-1', null)).toMatchObject({ status: 'completed' })
  client.close()
})
