import assert from 'node:assert/strict'
import { TRPCError } from '@trpc/server'
import { test } from 'vitest'
import { IDS, insertSession, sessionListCaller } from '@/mocks/sessions/session-list-caller'

const PROJECT = 'project-1'
const OTHER_PROJECT = 'project-2'
const archivedId = (index: number) => `00000000-0000-4000-8000-1${String(index).padStart(11, '0')}`

function callerWithOneSession() {
  const fixture = sessionListCaller()
  insertSession(fixture.client, {
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

test('archiving moves a Session from the active filter to the archived one and returns it', async () => {
  const { client, list, update } = callerWithOneSession()
  try {
    assert.deepEqual(await idsIn(list, 'active'), [IDS[0]])

    const row = await update({ sessionId: IDS[0], archived: true })

    assert.deepEqual({ id: row.id, archived: row.archived }, { id: IDS[0], archived: true })
    assert.deepEqual(await idsIn(list, 'active'), [])
    assert.deepEqual(await idsIn(list, 'archived'), [IDS[0]])
    assert.deepEqual(await idsIn(list, 'all'), [IDS[0]])
  } finally {
    client.close()
  }
})

test('unarchiving puts a Session back on the active filter', async () => {
  const { client, list, update } = callerWithOneSession()
  try {
    await update({ sessionId: IDS[0], archived: true })
    const row = await update({ sessionId: IDS[0], archived: false })

    assert.equal(row.archived, false)
    assert.deepEqual(await idsIn(list, 'active'), [IDS[0]])
    assert.deepEqual(await idsIn(list, 'archived'), [])
  } finally {
    client.close()
  }
})

test('a rename goes to the Harness, then stores the custom title', async () => {
  const { client, update, renames } = callerWithOneSession()
  try {
    const row = await update({ sessionId: IDS[0], title: 'Renamed' })

    assert.deepEqual(renames, [{ harness: 'claude', nativeId: 'native-1', title: 'Renamed' }])
    assert.deepEqual(row.title, { text: 'Renamed', source: 'custom' })
  } finally {
    client.close()
  }
})

test('an unknown Session is NOT_FOUND', async () => {
  const { client, update, renames } = callerWithOneSession()
  try {
    await assert.rejects(update({ sessionId: IDS[1], title: 'Renamed' }), (error) => {
      assert.ok(error instanceof TRPCError)
      assert.equal(error.code, 'NOT_FOUND')
      return true
    })
    assert.deepEqual(renames, [])
  } finally {
    client.close()
  }
})

test('pages the archived filter newest first, one Project at a time', async () => {
  const { client, list } = sessionListCaller()
  try {
    // Pairs share a creation time, so the Argo ID breaks the tie across a page boundary.
    const archived = Array.from({ length: 45 }, (_, index) => ({
      projectId: index % 3 === 2 ? OTHER_PROJECT : PROJECT,
      createdAt: 1_000 - Math.floor(index / 2),
    }))
    archived.forEach(({ projectId, createdAt }, index) => {
      insertSession(client, {
        id: archivedId(index),
        harness: 'claude',
        nativeId: `archived-${index}`,
        projectId,
        createdAt,
        archived: true,
      })
    })
    insertSession(client, { id: IDS[0], harness: 'claude', nativeId: 'active', createdAt: 2_000 })
    const expected = (projectId: string) =>
      archived.flatMap((row, index) => (row.projectId === projectId ? [archivedId(index)] : []))
    const allPages = async (projectId: string) => {
      const ids: string[] = []
      for (let offset = 0; ; offset += 20) {
        const page = await list({ projectId, filter: 'archived', offset, limit: 20 })
        ids.push(...page.rows.map(({ id }) => id))
        if (offset + 20 >= page.total) return ids
      }
    }

    assert.deepEqual(await allPages(PROJECT), expected(PROJECT))
    assert.deepEqual(await allPages(OTHER_PROJECT), expected(OTHER_PROJECT))
  } finally {
    client.close()
  }
})
