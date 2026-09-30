import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { Database } from '@/database/database'
import {
  IDS,
  insertSession,
  linkTicket,
  saveTicket,
  sessionListCaller,
} from '@/mocks/sessions/session-list-caller'

const manyId = (index: number) => `00000000-0000-4000-8000-2${String(index).padStart(11, '0')}`

// `matching` Sessions titled "Deploy n", newest first, then one titled "Unrelated".
function insertSearchCorpus(database: Database, matching: number) {
  for (let index = 0; index < matching; index += 1)
    insertSession(database, {
      id: manyId(index),
      harness: 'claude',
      nativeId: `deploy-${index}`,
      customTitle: `Deploy ${index}`,
      createdAt: 1_000 - index,
    })
  insertSession(database, {
    id: manyId(matching),
    harness: 'claude',
    nativeId: 'unrelated',
    customTitle: 'Unrelated',
    createdAt: 2_000,
  })
}

test('searches past the first page of results in list order', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSearchCorpus(database, 25)
    const first = await list({ projectId: 'project-1', search: 'deploy', limit: 10 })
    const last = await list({ projectId: 'project-1', search: 'deploy', offset: 20, limit: 10 })

    assert.deepEqual([first.total, last.total], [25, 25])
    assert.deepEqual(
      first.rows.map(({ id }) => id),
      Array.from({ length: 10 }, (_, index) => manyId(index)),
    )
    assert.deepEqual(
      last.rows.map(({ id }) => id),
      Array.from({ length: 5 }, (_, index) => manyId(20 + index)),
    )
  } finally {
    database.$client.close()
  }
})

test('matches the shown title without case, and never a first prompt another title hides', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      customTitle: 'Custom match',
      preview: 'Older summary',
      firstPrompt: 'Hidden first prompt',
      createdAt: 10,
    })
    insertSession(database, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'native-2',
      preview: 'Preview match',
      firstPrompt: 'Another hidden prompt',
      createdAt: 20,
    })

    const custom = await list({ projectId: 'project-1', search: 'CUSTOM' })
    const preview = await list({ projectId: 'project-1', search: 'preview' })
    const prompt = await list({ projectId: 'project-1', search: 'hidden' })

    assert.deepEqual(
      custom.rows.map(({ id }) => id),
      [IDS[0]],
    )
    assert.deepEqual(
      preview.rows.map(({ id }) => id),
      [IDS[1]],
    )
    assert.equal(prompt.total, 0)
  } finally {
    database.$client.close()
  }
})

test('finds a Session by the Ticket title or first prompt it shows', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: IDS[0],
      nativeId: 'native-1',
      preview: 'Vendor summary',
      createdAt: 20,
    })
    saveTicket(database, { key: '#2937', title: 'Page the archive' })
    linkTicket(database, { sessionId: IDS[0], key: '#2937' })
    insertSession(database, { id: IDS[1], nativeId: 'native-2', firstPrompt: 'Fix the badge' })

    const ticket = await list({ projectId: 'project-1', search: 'archive' })
    const prompt = await list({ projectId: 'project-1', search: 'badge' })
    const hidden = await list({ projectId: 'project-1', search: 'vendor' })

    assert.deepEqual(
      ticket.rows.map(({ id }) => id),
      [IDS[0]],
    )
    assert.deepEqual(
      prompt.rows.map(({ id }) => id),
      [IDS[1]],
    )
    assert.equal(hidden.total, 0)
  } finally {
    database.$client.close()
  }
})

test('a search in another Project reads only that Project’s matches', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSearchCorpus(database, 3)
    insertSession(database, {
      id: IDS[0],
      harness: 'codex',
      nativeId: 'elsewhere',
      customTitle: 'Deploy elsewhere',
      projectId: 'project-2',
      createdAt: 10,
    })
    const first = await list({ projectId: 'project-1', search: 'deploy' })
    const second = await list({ projectId: 'project-2', search: 'deploy' })

    assert.equal(first.total, 3)
    assert.deepEqual(
      second.rows.map(({ id }) => id),
      [IDS[0]],
    )
    assert.equal(second.total, 1)
  } finally {
    database.$client.close()
  }
})
