import assert from 'node:assert/strict'
import type { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import {
  IDS,
  insertSession,
  type SessionListUpdate,
  sessionListCaller,
  settled,
} from '@/mocks/sessions/session-list-caller'

const manyId = (index: number) => `00000000-0000-4000-8000-2${String(index).padStart(11, '0')}`

// `matching` Sessions titled "Deploy n", newest first, then one titled "Unrelated".
function insertSearchCorpus(client: DatabaseSync, matching: number) {
  for (let index = 0; index < matching; index += 1)
    insertSession(client, {
      id: manyId(index),
      harness: 'claude',
      nativeId: `deploy-${index}`,
      customTitle: `Deploy ${index}`,
      updatedAt: 1_000 - index,
    })
  insertSession(client, {
    id: manyId(matching),
    harness: 'claude',
    nativeId: 'unrelated',
    customTitle: 'Unrelated',
    updatedAt: 2_000,
  })
}

const idsOfLists = (received: SessionListUpdate[]) =>
  received.flatMap((update) => (update.type === 'list' ? [update.rows.map(({ id }) => id)] : []))

test('searches past the first page of results in list order', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSearchCorpus(client, 25)
    const first = await list({ projectId: 'project-1', search: 'deploy', pageSize: 10 })
    const three = await list({ projectId: 'project-1', search: 'deploy', pageSize: 10, pages: 3 })

    assert.equal(first.total, 25)
    assert.deepEqual(
      first.rows.map(({ id }) => id),
      Array.from({ length: 10 }, (_, index) => manyId(index)),
    )
    assert.deepEqual(
      three.rows.map(({ id }) => id),
      Array.from({ length: 25 }, (_, index) => manyId(index)),
    )
  } finally {
    client.close()
  }
})

test('an activity change reorders search results without scanning again', async () => {
  const { client, updates, roster, searchScans } = sessionListCaller()
  try {
    insertSearchCorpus(client, 12)
    const { received, stop } = await updates({
      projectId: 'project-1',
      search: 'deploy',
      pageSize: 5,
    })
    assert.equal(searchScans.count, 1)

    // The oldest match is past the loaded page; its Turn opening moves it to the top.
    client.prepare('UPDATE session SET list_order_at = 5000 WHERE argo_id = ?').run(manyId(11))
    roster.changed('activity')
    await settled()
    assert.equal(searchScans.count, 1)

    client
      .prepare("UPDATE session SET custom_title = 'Deploy again' WHERE argo_id = ?")
      .run(manyId(12))
    roster.changed('membership')
    await settled()
    stop()

    assert.equal(searchScans.count, 2)
    assert.deepEqual(idsOfLists(received), [
      [0, 1, 2, 3, 4].map(manyId),
      [11, 0, 1, 2, 3].map(manyId),
      [11, 12, 0, 1, 2].map(manyId),
    ])
    const last = received.at(-1)
    assert.equal(last?.type === 'list' ? last.total : null, 13)
  } finally {
    client.close()
  }
})

test('a live status change scans the search again only for a Session that now matches', async () => {
  const { client, updates, statusChanged, searchScans } = sessionListCaller()
  try {
    insertSearchCorpus(client, 3)
    const { received, stop } = await updates({
      projectId: 'project-1',
      search: 'deploy',
      pageSize: 5,
    })

    statusChanged(manyId(3))
    await settled()
    assert.equal(searchScans.count, 1)

    client
      .prepare("UPDATE session SET custom_title = 'Deploy live' WHERE argo_id = ?")
      .run(manyId(3))
    statusChanged(manyId(3))
    await settled()
    stop()

    assert.equal(searchScans.count, 2)
    assert.deepEqual(idsOfLists(received).at(-1), [3, 0, 1, 2].map(manyId))
  } finally {
    client.close()
  }
})

test('a search in another Project reads only that Project’s matches', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSearchCorpus(client, 3)
    insertSession(client, {
      id: IDS[0],
      harness: 'codex',
      nativeId: 'elsewhere',
      customTitle: 'Deploy elsewhere',
      projectId: 'project-2',
      updatedAt: 10,
    })
    const first = await list({ projectId: 'project-1', search: 'deploy', pageSize: 10 })
    const second = await list({ projectId: 'project-2', search: 'deploy', pageSize: 10 })

    assert.equal(first.total, 3)
    assert.deepEqual(
      second.rows.map(({ id }) => id),
      [IDS[0]],
    )
    assert.equal(second.total, 1)
  } finally {
    client.close()
  }
})
