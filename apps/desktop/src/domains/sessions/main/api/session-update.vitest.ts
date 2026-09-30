import assert from 'node:assert/strict'
import { test } from 'vitest'
import { sessionTable } from '@/database/session/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { SessionRosterChanges } from './session-roster-changes'
import { clearWorkingStatuses, updateHarnessSession, updateSession } from './session-update'

const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

type SessionTableStatus = typeof sessionTable.$inferInsert.status

function sessionsWithStatuses(statuses: readonly SessionTableStatus[]) {
  const database = migratedDatabase()
  const client = database.$client
  for (const [index, status] of statuses.entries())
    database
      .insert(sessionTable)
      .values({ argoId: IDS[index] ?? '', harness: 'claude', nativeId: `native-${index}`, status })
      .run()
  const roster = new SessionRosterChanges()
  const announced: (readonly string[])[] = []
  roster.subscribe((sessionIds) => announced.push(sessionIds))
  const statusesNow = () =>
    client
      .prepare('SELECT status FROM session ORDER BY argo_id')
      .all()
      .map((row) => row.status)
  return { client, database, roster, announced, statusesNow }
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

test('history activity moves a saved Session forward only, and reports one never saved', () => {
  const { client, database, roster, announced } = sessionsWithStatuses([null])
  const activityAt = () => client.prepare('SELECT activity_at FROM session').get()?.activity_at
  const context = { database, roster }
  try {
    const saved = { harness: 'claude' as const, nativeId: 'native-0' }
    assert.equal(updateHarnessSession(context, saved, { activityAt: 20 }), true)
    assert.equal(updateHarnessSession(context, saved, { activityAt: 10 }), true)
    assert.equal(activityAt(), 20)
    assert.deepEqual(announced, [[IDS[0]], [IDS[0]]])

    assert.equal(
      updateHarnessSession(context, { harness: 'claude', nativeId: 'unsaved' }, { activityAt: 30 }),
      false,
    )
    assert.equal(activityAt(), 20)
  } finally {
    client.close()
  }
})
