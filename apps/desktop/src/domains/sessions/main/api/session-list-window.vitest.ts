import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  IDS,
  insertOrderedSessions,
  insertSession,
  sessionListCaller,
  settled,
} from '@/mocks/sessions/session-list-caller.fixture'
import { createSessionUpsert } from '../database/session-upsert'
import { SESSION_LIST_WINDOW_SIDE, seekLaterQuery, sessionListFilter } from './session-list'
import { recordHistoryActivity } from './session-roster-changes'

test('reads the first window in list order with an Argo ID tie-breaker', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[2],
      harness: 'claude',
      nativeId: 'shared-native-id',
      firstPrompt: 'third',
      activityAt: 10,
      updatedAt: 30,
    })
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'claude-native-id',
      firstPrompt: 'first',
      updatedAt: 20,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'shared-native-id',
      firstPrompt: 'second',
      updatedAt: 20,
    })
    insertSession(client, {
      id: '00000000-0000-4000-8000-000000000004',
      harness: 'claude',
      nativeId: 'other-project',
      projectId: 'project-2',
      firstPrompt: 'other project',
      updatedAt: 40,
    })

    const first = await list({ projectId: 'project-1', after: 2 })

    assert.deepEqual(
      first.rows.map(({ id }) => id),
      [IDS[1], IDS[0]],
    )
    assert.deepEqual({ total: first.total, offset: first.offset }, { total: 3, offset: 0 })
    assert.equal(JSON.stringify(first).includes('native'), false)
    assert.equal(JSON.stringify(first).includes('watched'), false)
  } finally {
    client.close()
  }
})

test('seeks both ways around an anchor and reports its logical position', async () => {
  const { client, list } = sessionListCaller()
  try {
    const ids = insertOrderedSessions(client, 50)
    const top = await list({ projectId: 'project-1', after: 10 })
    const anchor = top.rows[5]
    assert.ok(anchor !== undefined)

    const window = await list({
      projectId: 'project-1',
      anchor: { kind: 'key', listOrderAt: anchor.listOrderAt, id: anchor.id },
      before: 3,
      after: 4,
    })

    assert.deepEqual(
      window.rows.map(({ id }) => id),
      ids.slice(2, 9),
    )
    assert.deepEqual({ total: window.total, offset: window.offset }, { total: 50, offset: 2 })
  } finally {
    client.close()
  }
})

test('seeks the nearest surviving neighbour when the anchor moved or was deleted', async () => {
  const { client, list } = sessionListCaller()
  try {
    const ids = insertOrderedSessions(client, 20)
    const anchored = (await list({ projectId: 'project-1', after: 20 })).rows[8]
    assert.ok(anchored !== undefined)
    const anchor = { kind: 'key', listOrderAt: anchored.listOrderAt, id: anchored.id } as const

    client.prepare('UPDATE session SET list_order_at = 20000 WHERE argo_id = ?').run(anchored.id)
    const moved = await list({ projectId: 'project-1', anchor, before: 1, after: 2 })
    client.prepare('DELETE FROM session WHERE argo_id = ?').run(anchored.id)
    const deleted = await list({ projectId: 'project-1', anchor, before: 1, after: 2 })

    for (const window of [moved, deleted]) {
      assert.deepEqual(
        window.rows.map(({ id }) => id),
        [ids[7], ids[9], ids[10]],
      )
    }
    assert.equal(moved.offset, 8)
  } finally {
    client.close()
  }
})

test('jumps to a list position and to the end without reading the rows before it', async () => {
  const { client, list } = sessionListCaller()
  try {
    const ids = insertOrderedSessions(client, 30)

    const middle = await list({
      projectId: 'project-1',
      anchor: { kind: 'index', index: 12 },
      before: 2,
      after: 3,
    })
    const end = await list({ projectId: 'project-1', anchor: { kind: 'end' }, before: 2, after: 5 })

    assert.deepEqual(
      middle.rows.map(({ id }) => id),
      ids.slice(10, 15),
    )
    assert.equal(middle.offset, 10)
    assert.deepEqual(
      end.rows.map(({ id }) => id),
      ids.slice(27),
    )
    assert.equal(end.offset, 27)
  } finally {
    client.close()
  }
})

test('reads a commit that landed before the change listener attached', async () => {
  const { client, list, changes, roster } = sessionListCaller()
  try {
    insertOrderedSessions(client, 1)
    roster.changed()
    await settled()
    const { received, stop } = await changes()
    const first = await list({ projectId: 'project-1' })
    stop()

    assert.deepEqual(received, ['invalidated'])
    assert.deepEqual(
      first.rows.map((row) => row.title?.text),
      ['Session 0'],
    )
  } finally {
    client.close()
  }
})

test('bounds every window side', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertOrderedSessions(client, 5)
    await assert.rejects(() =>
      list({ projectId: 'project-1', after: SESSION_LIST_WINDOW_SIDE + 1 }),
    )
    await assert.rejects(() =>
      list({ projectId: 'project-1', before: SESSION_LIST_WINDOW_SIDE + 1 }),
    )
  } finally {
    client.close()
  }
})

test('browses and searches by the list order index with no temporary sort', () => {
  const { client, database } = sessionListCaller()
  try {
    insertOrderedSessions(client, 40)
    const plan = (search: string) => {
      const query = seekLaterQuery(
        { database, filter: sessionListFilter({ projectId: 'project-1', search }) },
        { listOrderAt: 9_990, id: IDS[0] },
        30,
      ).toSQL()
      return client
        .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
        .all(...(query.params as (string | number)[]))
        .map((row) => String(row.detail))
    }

    for (const detail of [plan(''), plan('Session')]) {
      assert.ok(
        detail.some((step) => /^SEARCH session USING .*INDEX session_list_order/.test(step)),
        detail.join('\n'),
      )
      assert.equal(
        detail.some((step) => step.includes('TEMP B-TREE')),
        false,
        detail.join('\n'),
      )
    }
  } finally {
    client.close()
  }
})

test('moves a Session in the list only on discovery and Turn transitions', async () => {
  const { client, database, list } = sessionListCaller()
  try {
    const upsert = createSessionUpsert(database)
    const session = (nativeId: string, activityAt: number) =>
      upsert({
        harness: 'claude',
        nativeId,
        projectId: 'project-1',
        firstPrompt: nativeId,
        activityAt,
      })
    session('streaming', 100)
    session('other', 200)
    const order = async () =>
      (await list({ projectId: 'project-1' })).rows.map((row) => row.title?.text)
    const write = (at: number, turnChanged: boolean) =>
      recordHistoryActivity(database, { harness: 'claude', nativeId: 'streaming', at, turnChanged })

    write(300, false)
    const afterWrite = await order()
    write(400, true)
    const afterTurn = await order()
    session('other', 500)
    const afterDiscovery = await order()

    assert.deepEqual(afterWrite, ['other', 'streaming'])
    assert.deepEqual(afterTurn, ['streaming', 'other'])
    assert.deepEqual(afterDiscovery, ['other', 'streaming'])
  } finally {
    client.close()
  }
})
