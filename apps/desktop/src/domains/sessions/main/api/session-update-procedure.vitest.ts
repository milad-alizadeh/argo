import assert from 'node:assert/strict'
import { TRPCError } from '@trpc/server'
import { test } from 'vitest'
import { IDS, insertSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'

const PROJECT = 'project-1'

function callerWithOneSession() {
  const fixture = sessionListCaller()
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

test('archiving moves a Session from the active filter to the archived one and returns its ID', async () => {
  const { client, list, update, details } = callerWithOneSession()
  try {
    assert.deepEqual(await idsIn(list, 'active'), [IDS[0]])

    assert.deepEqual(await update({ sessionIds: [IDS[0]], archived: true }), {
      sessionIds: [IDS[0]],
    })

    assert.equal((await details({ sessionId: IDS[0] }))?.archived, true)
    assert.deepEqual(await idsIn(list, 'active'), [])
    assert.deepEqual(await idsIn(list, 'archived'), [IDS[0]])
    assert.deepEqual(await idsIn(list, 'all'), [IDS[0]])
  } finally {
    client.close()
  }
})

test('unarchiving puts a Session back on the active filter', async () => {
  const { client, list, update, details } = callerWithOneSession()
  try {
    await update({ sessionIds: [IDS[0]], archived: true })
    await update({ sessionIds: [IDS[0]], archived: false })

    assert.equal((await details({ sessionId: IDS[0] }))?.archived, false)
    assert.deepEqual(await idsIn(list, 'active'), [IDS[0]])
    assert.deepEqual(await idsIn(list, 'archived'), [])
  } finally {
    client.close()
  }
})

test('a rename goes to the Harness, then stores the custom title', async () => {
  const { client, update, details, renames } = callerWithOneSession()
  try {
    await update({ sessionIds: [IDS[0]], title: 'Renamed' })

    assert.deepEqual(renames, [{ harness: 'claude', nativeId: 'native-1', title: 'Renamed' }])
    assert.deepEqual((await details({ sessionId: IDS[0] }))?.title, {
      text: 'Renamed',
      source: 'custom',
    })
  } finally {
    client.close()
  }
})

test('a title is stored with control characters and repeated spaces collapsed', async () => {
  const { client, update, details, renames } = callerWithOneSession()
  try {
    await update({ sessionIds: [IDS[0]], title: '  Fix\tthe\n\nroster  ' })

    assert.equal(renames[0]?.title, 'Fix the roster')
    assert.equal((await details({ sessionId: IDS[0] }))?.customTitle, 'Fix the roster')
    await assert.rejects(update({ sessionIds: [IDS[0]], title: ' \u0007 ' }))
  } finally {
    client.close()
  }
})

test('archiving several Sessions returns the known ones and skips an unknown ID', async () => {
  const { client, list, update } = callerWithOneSession()
  try {
    assert.deepEqual(await update({ sessionIds: [IDS[0], IDS[1]], archived: true }), {
      sessionIds: [IDS[0]],
    })
    assert.deepEqual(await idsIn(list, 'archived'), [IDS[0]])
  } finally {
    client.close()
  }
})

test('a title for more than one Session is rejected before the Harness sees it', async () => {
  const { client, update, renames } = callerWithOneSession()
  try {
    await assert.rejects(update({ sessionIds: [IDS[0], IDS[1]], title: 'Renamed' }))
    assert.deepEqual(renames, [])
  } finally {
    client.close()
  }
})

test('renaming an unknown Session is NOT_FOUND', async () => {
  const { client, update, renames } = callerWithOneSession()
  try {
    await assert.rejects(update({ sessionIds: [IDS[1]], title: 'Renamed' }), (error) => {
      assert.ok(error instanceof TRPCError)
      assert.equal(error.code, 'NOT_FOUND')
      return true
    })
    assert.deepEqual(renames, [])
  } finally {
    client.close()
  }
})
