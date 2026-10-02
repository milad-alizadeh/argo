import assert from 'node:assert/strict'
import { TRPCError } from '@trpc/server'
import { test } from 'vitest'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import {
  IDS,
  insertSession,
  sessionListCaller,
  settled,
} from '@/mocks/sessions/session-list-caller'
import { SessionListChanges } from './session-list-changes'
import {
  clearWorkingStatuses,
  type SessionUpdate,
  updateHarnessSession,
  updateSession,
} from './session-update'

function sessionsWithStatuses(statuses: readonly NonNullable<SessionUpdate['status']>[]) {
  const database = migratedDatabase()
  const client = database.$client
  for (const [index, status] of statuses.entries())
    insertSession(database, { id: IDS[index] ?? '', nativeId: `native-${index}`, status })
  const changes = new SessionListChanges()
  const announced: (readonly string[])[] = []
  changes.subscribe((sessionIds) => announced.push(sessionIds))
  const statusesNow = () =>
    client
      .prepare('SELECT status FROM session ORDER BY argo_id')
      .all()
      .map((row) => row.status)
  return { client, context: { database, changes }, announced, statusesNow }
}

test('stores a status and announces only that Session', async () => {
  const { client, context, announced, statusesNow } = sessionsWithStatuses(['unknown', 'unknown'])
  try {
    assert.equal(updateSession(context, IDS[1], { status: 'running' }), true)

    assert.deepEqual(statusesNow(), ['unknown', 'running'])
    await settled()
    assert.deepEqual(announced, [[IDS[1]]])
  } finally {
    client.close()
  }
})

test('an unknown Session changes nothing and announces nothing', async () => {
  const { client, context, announced, statusesNow } = sessionsWithStatuses(['unknown'])
  try {
    assert.equal(updateSession(context, IDS[2], { status: 'running' }), false)

    assert.deepEqual(statusesNow(), ['unknown'])
    await settled()
    assert.deepEqual(announced, [])
  } finally {
    client.close()
  }
})

test('a write that changes nothing announces nothing', async () => {
  const { client, context, announced } = sessionsWithStatuses(['running'])
  const activity = { label: 'Ran bun test', kind: 'command' as const, open: true }
  try {
    updateSession(context, IDS[0], { activity, archived: true })
    await settled()
    announced.length = 0

    assert.equal(updateSession(context, IDS[0], { status: 'running' }), true)
    assert.equal(updateSession(context, IDS[0], { activity }), true)
    assert.equal(updateSession(context, IDS[0], { archived: true }), true)
    await settled()
    assert.deepEqual(announced, [])
    assert.equal(updateSession(context, IDS[0], { archived: false }), true)
    await settled()
    assert.deepEqual(announced, [[IDS[0]]])
  } finally {
    client.close()
  }
})

test('stores Model, Effort, Mode and Plan progress, reads them back, and announces only a change', async () => {
  const { database, details, sessionListChanges, stopWatching } = sessionListCaller()
  insertSession(database, { id: IDS[0], nativeId: 'native-0' })
  const announced: (readonly string[])[] = []
  sessionListChanges.subscribe((sessionIds) => announced.push(sessionIds))
  const context = { database, changes: sessionListChanges }
  const written = { model: 'opus', effort: 'high', mode: 'plan' }
  try {
    assert.equal(
      updateSession(context, IDS[0], {
        turnConfiguration: written,
        planProgress: { completed: 1, total: 3 },
      }),
      true,
    )
    await settled()
    assert.deepEqual(announced, [[IDS[0]]])
    const row = await details({ sessionId: IDS[0] })
    assert.deepEqual(row?.turnConfiguration, written)
    assert.deepEqual(row?.planProgress, { completed: 1, total: 3 })

    updateSession(context, IDS[0], {
      turnConfiguration: written,
      planProgress: { completed: 1, total: 3 },
    })
    await settled()
    assert.deepEqual(announced, [[IDS[0]]])

    updateSession(context, IDS[0], { planProgress: { completed: 2, total: 3 } })
    await settled()
    assert.deepEqual(announced, [[IDS[0]], [IDS[0]]])
    assert.deepEqual((await details({ sessionId: IDS[0] }))?.planProgress, {
      completed: 2,
      total: 3,
    })
  } finally {
    stopWatching()
    database.$client.close()
  }
})

test('a Session never written has no Model, Effort, Mode or Plan progress', async () => {
  const { database, details, stopWatching } = sessionListCaller()
  insertSession(database, { id: IDS[0], nativeId: 'native-0' })
  try {
    const row = await details({ sessionId: IDS[0] })
    assert.deepEqual(row?.turnConfiguration, { model: null, effort: null, mode: null })
    assert.equal(row?.planProgress, null)
  } finally {
    stopWatching()
    database.$client.close()
  }
})

test('a restart clears working statuses and keeps settled ones', () => {
  const { client, context, statusesNow } = sessionsWithStatuses(['permission', 'idle', 'unknown'])
  try {
    clearWorkingStatuses(context.database)

    assert.deepEqual(statusesNow(), ['unknown', 'idle', 'unknown'])
  } finally {
    client.close()
  }
})

test('history activity moves a saved Session forward only, and reports one never saved', async () => {
  const { client, context, announced } = sessionsWithStatuses(['unknown'])
  const activityAt = () => client.prepare('SELECT activity_at FROM session').get()?.activity_at
  try {
    const saved = { harness: 'claude' as const, nativeId: 'native-0' }
    assert.equal(updateHarnessSession(context, saved, { activityAt: 20 }), true)
    await settled()
    assert.equal(updateHarnessSession(context, saved, { activityAt: 10 }), true)
    await settled()
    assert.equal(activityAt(), 20)
    assert.deepEqual(announced, [[IDS[0]]])

    assert.equal(
      updateHarnessSession(context, { harness: 'claude', nativeId: 'unsaved' }, { activityAt: 30 }),
      false,
    )
    assert.equal(activityAt(), 20)
  } finally {
    client.close()
  }
})

const PROJECT = 'project-1'

function callerWithOneSession(
  rename?: NonNullable<Parameters<typeof sessionListCaller>[0]>['rename'],
) {
  const fixture = sessionListCaller({ rename })
  insertSession(fixture.database, {
    id: IDS[0],
    harness: 'claude',
    nativeId: 'native-1',
    firstPrompt: 'hello',
    createdAt: 10,
  })
  return fixture
}

async function idsIn(
  list: ReturnType<typeof sessionListCaller>['list'],
  filter: 'active' | 'archived' | 'all',
) {
  return (await list({ projectId: PROJECT, filter })).rows.map(({ id }) => id)
}

test('archiving moves known Sessions to the archived filter and back, skipping an unknown ID', async () => {
  const { database, list, update, details, removalRequests } = callerWithOneSession()
  try {
    assert.deepEqual(await idsIn(list, 'active'), [IDS[0]])

    assert.deepEqual(await update({ sessionIds: [IDS[0], IDS[1]], archived: true }), {
      sessionIds: [IDS[0]],
    })
    assert.equal((await details({ sessionId: IDS[0] }))?.archived, true)
    assert.deepEqual(await idsIn(list, 'active'), [])
    assert.deepEqual(await idsIn(list, 'archived'), [IDS[0]])
    assert.deepEqual(await idsIn(list, 'all'), [IDS[0]])
    assert.deepEqual(removalRequests, [{ sessionIds: [IDS[0]], removal: 'clean' }])

    await update({ sessionIds: [IDS[0]], archived: false })
    assert.equal((await details({ sessionId: IDS[0] }))?.archived, false)
    assert.equal(removalRequests.length, 1)
    assert.deepEqual(await idsIn(list, 'active'), [IDS[0]])
    assert.deepEqual(await idsIn(list, 'archived'), [])
  } finally {
    database.$client.close()
  }
})

test('an archive the person confirmed with Remove asks to remove every Session worktree', async () => {
  const { database, update, removalRequests } = callerWithOneSession()
  try {
    await update({ sessionIds: [IDS[0]], archived: true, worktrees: 'all' })
    assert.deepEqual(removalRequests, [{ sessionIds: [IDS[0]], removal: 'all' }])
  } finally {
    database.$client.close()
  }
})

test('a rename goes to the Harness, then stores the custom title', async () => {
  const { database, update, details, renames } = callerWithOneSession()
  try {
    await update({ sessionIds: [IDS[0]], title: 'Renamed' })

    assert.deepEqual(renames, [{ harness: 'claude', nativeId: 'native-1', title: 'Renamed' }])
    assert.equal((await details({ sessionId: IDS[0] }))?.name, 'Renamed')
  } finally {
    database.$client.close()
  }
})

test('a title is stored with control characters and repeated spaces collapsed', async () => {
  const { database, update, details, renames } = callerWithOneSession()
  try {
    await update({ sessionIds: [IDS[0]], title: '  Fix\tthe\n\nSession List  ' })

    assert.equal(renames[0]?.title, 'Fix the Session List')
    assert.equal((await details({ sessionId: IDS[0] }))?.name, 'Fix the Session List')
    await assert.rejects(update({ sessionIds: [IDS[0]], title: ' \u0007 ' }))
  } finally {
    database.$client.close()
  }
})

test('keeps the existing title when the Harness rejects a rename', async () => {
  const { database, update, details } = callerWithOneSession(async () => {
    throw new Error('Harness rejected the rename.')
  })
  try {
    await assert.rejects(update({ sessionIds: [IDS[0]], title: 'Rejected title' }), {
      message: 'Harness rejected the rename.',
    })
    assert.equal((await details({ sessionId: IDS[0] }))?.name, 'hello')
  } finally {
    database.$client.close()
  }
})

test('a title for more than one Session is rejected before the Harness sees it', async () => {
  const { database, update, renames } = callerWithOneSession()
  try {
    await assert.rejects(update({ sessionIds: [IDS[0], IDS[1]], title: 'Renamed' }))
    assert.deepEqual(renames, [])
  } finally {
    database.$client.close()
  }
})

test('renaming an unknown Session is NOT_FOUND', async () => {
  const { database, update, renames } = callerWithOneSession()
  try {
    await assert.rejects(update({ sessionIds: [IDS[1]], title: 'Renamed' }), (error) => {
      assert.ok(error instanceof TRPCError)
      assert.equal(error.code, 'NOT_FOUND')
      return true
    })
    assert.deepEqual(renames, [])
  } finally {
    database.$client.close()
  }
})
