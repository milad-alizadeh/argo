import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { Database } from '@/database/database'
import {
  IDS,
  insertSession,
  sessionListCaller,
  settled,
} from '@/mocks/sessions/session-list-caller'

function insertTwoSessions(database: Database) {
  insertSession(database, { id: IDS[0], harness: 'claude', nativeId: 'native-1', createdAt: 20 })
  insertSession(database, { id: IDS[1], harness: 'claude', nativeId: 'native-2', createdAt: 10 })
}

test('a live status change names that Session', async () => {
  let status = 'running'
  const session = {
    getSnapshot: () => ({
      value: 'Ready',
      matches: (candidate: string) => candidate === 'Ready',
      context: { status, turnConfiguration: { model: null, effort: null, mode: null } },
    }),
  }
  const { database, changes, statusChanged } = sessionListCaller({
    sessions: { [IDS[0]]: session },
  })
  try {
    insertTwoSessions(database)
    const { received, stop } = await changes()

    status = 'idle'
    statusChanged(IDS[0])
    await settled()
    stop()

    assert.deepEqual(received, [{ sessionIds: [IDS[0]] }])
  } finally {
    database.$client.close()
  }
})

test('a burst of announcements in one tick sends one change', async () => {
  const { database, changes, sessionListChanges, statusChanged } = sessionListCaller()
  try {
    insertTwoSessions(database)
    const { received, stop } = await changes()

    sessionListChanges.changed([IDS[0]])
    statusChanged(IDS[1])
    sessionListChanges.changed([IDS[0], IDS[2]])
    await settled()
    stop()

    assert.deepEqual(received, [{ sessionIds: [IDS[0], IDS[1], IDS[2]] }])
  } finally {
    database.$client.close()
  }
})
