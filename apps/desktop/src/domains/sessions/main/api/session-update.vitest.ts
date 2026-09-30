import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import { SessionRosterChanges } from './session-roster-changes'
import { clearWorkingStatuses, updateSession } from './session-update'

const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

function sessionsWithStatuses(statuses: readonly (string | null)[]) {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    custom_title TEXT,
    activity TEXT,
    status TEXT,
    updated_at INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE session_archive (session_id TEXT PRIMARY KEY);`)
  for (const [index, status] of statuses.entries())
    client
      .prepare('INSERT INTO session (argo_id, status) VALUES (?, ?)')
      .run(IDS[index] ?? '', status)
  const roster = new SessionRosterChanges()
  const announced: (readonly string[])[] = []
  roster.subscribe((sessionIds) => announced.push(sessionIds))
  const statusesNow = () =>
    client
      .prepare('SELECT status FROM session ORDER BY argo_id')
      .all()
      .map((row) => row.status)
  return { client, database: databaseFrom(client), roster, announced, statusesNow }
}

test('stores a status and announces only that Session', () => {
  const { client, database, roster, announced, statusesNow } = sessionsWithStatuses([null, null])
  try {
    assert.equal(updateSession({ database, roster }, IDS[1], { status: 'running' }), true)

    assert.deepEqual(statusesNow(), [null, 'running'])
    assert.deepEqual(announced, [[IDS[1]]])
  } finally {
    client.close()
  }
})

test('an unknown Session changes nothing and announces nothing', () => {
  const { client, database, roster, announced, statusesNow } = sessionsWithStatuses([null])
  try {
    assert.equal(updateSession({ database, roster }, IDS[2], { status: 'running' }), false)

    assert.deepEqual(statusesNow(), [null])
    assert.deepEqual(announced, [])
  } finally {
    client.close()
  }
})

test('a restart clears working statuses and keeps settled ones', () => {
  const { client, database, statusesNow } = sessionsWithStatuses(['permission', 'idle', null])
  try {
    clearWorkingStatuses(database)

    assert.deepEqual(statusesNow(), ['unknown', 'idle', null])
  } finally {
    client.close()
  }
})
