import assert from 'node:assert/strict'
import type { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import {
  IDS,
  insertSession,
  liveSession,
  type SessionListChange,
  sessionListCaller,
  settled,
} from '@/mocks/sessions/session-list-caller'

function insertTwoSessions(client: DatabaseSync) {
  insertSession(client, { id: IDS[0], harness: 'claude', nativeId: 'native-1', createdAt: 20 })
  insertSession(client, { id: IDS[1], harness: 'claude', nativeId: 'native-2', createdAt: 10 })
}

const idsOf = (received: SessionListChange[]) =>
  received.map((change) => change.rows.map(({ id }) => id))

test('a roster announcement sends just the rows it names, read again', async () => {
  const { client, changes, roster } = sessionListCaller()
  try {
    insertTwoSessions(client)
    const { received, stop } = await changes()

    client.prepare("UPDATE session SET custom_title = 'Renamed' WHERE argo_id = ?").run(IDS[1])
    roster.changed([IDS[1]])
    await settled()
    stop()

    assert.deepEqual(
      received.map((change) => change.rows.map(({ id, customTitle }) => ({ id, customTitle }))),
      [[{ id: IDS[1], customTitle: 'Renamed' }]],
    )
  } finally {
    client.close()
  }
})

test('a live status change sends that row without a roster announcement', async () => {
  let status = 'running'
  const session = {
    getSnapshot: () => ({
      value: 'Ready',
      matches: (candidate: string) => candidate === 'Ready',
      context: { status, turnConfiguration: { model: null, effort: null, mode: null } },
    }),
  }
  const { client, changes, statusChanged } = sessionListCaller({ [IDS[0]]: session })
  try {
    insertTwoSessions(client)
    const { received, stop } = await changes()

    status = 'idle'
    statusChanged(IDS[0])
    await settled()
    stop()

    assert.deepEqual(
      received.map((change) => change.rows.map(({ id, status }) => ({ id, status }))),
      [[{ id: IDS[0], status: 'idle' }]],
    )
  } finally {
    client.close()
  }
})

test('an announcement of an unknown Session sends nothing', async () => {
  const { client, changes, roster } = sessionListCaller()
  try {
    insertTwoSessions(client)
    const { received, stop } = await changes()

    roster.changed([IDS[2]])
    await settled()
    stop()

    assert.deepEqual(received, [])
  } finally {
    client.close()
  }
})

test('a burst of announcements in one tick sends one change', async () => {
  const { client, changes, roster, statusChanged } = sessionListCaller()
  try {
    insertTwoSessions(client)
    const { received, stop } = await changes()

    roster.changed([IDS[0]])
    statusChanged(IDS[1])
    roster.changed([IDS[0], IDS[2]])
    await settled()
    stop()

    assert.deepEqual(idsOf(received), [[IDS[0], IDS[1]]])
  } finally {
    client.close()
  }
})

test('opens a Feed reader only for working Sessions, and closes them on unsubscribe', async () => {
  const observed = new Map<string, number>()
  const observeFeed = (sessionId: string) => {
    observed.set(sessionId, (observed.get(sessionId) ?? 0) + 1)
    return () => observed.delete(sessionId)
  }
  const { client, changes, roster } = sessionListCaller(
    { [IDS[0]]: liveSession('Ready', 'running') },
    observeFeed,
  )
  try {
    insertTwoSessions(client)
    insertSession(client, {
      id: IDS[2],
      harness: 'codex',
      nativeId: 'native-3',
      status: 'idle',
      createdAt: 5,
    })
    const { stop } = await changes()
    assert.deepEqual(observed, new Map([[IDS[0], 1]]))

    client.prepare("UPDATE session SET status = 'permission' WHERE argo_id = ?").run(IDS[1])
    roster.changed([IDS[1]])
    await settled()
    assert.deepEqual(
      observed,
      new Map([
        [IDS[0], 1],
        [IDS[1], 1],
      ]),
    )

    client.prepare("UPDATE session SET status = 'idle' WHERE argo_id = ?").run(IDS[1])
    roster.changed([IDS[1]])
    await settled()
    assert.deepEqual(observed, new Map([[IDS[0], 1]]))

    stop()
    assert.equal(observed.size, 0)
  } finally {
    client.close()
  }
})
