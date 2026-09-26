import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import { sessionListProcedure } from './session-list'

const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

function sessionListCaller(sessions: Record<string, unknown> = {}) {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE session (
    argo_id TEXT PRIMARY KEY,
    harness TEXT NOT NULL,
    native_id TEXT NOT NULL,
    project_id TEXT,
    workspace_id TEXT,
    custom_title TEXT,
    preview TEXT,
    first_prompt TEXT,
    cwd TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
  const database = databaseFrom(client)
  const supervisor = {
    getSnapshot: () => ({ context: { sessions } }),
  }
  const router = initTRPC.create().router({
    list: sessionListProcedure({ database, supervisor: supervisor as never }),
  })
  return { client, list: router.createCaller({}).list }
}

function liveSession(state: string) {
  return {
    getSnapshot: () => ({
      value: state,
      matches: (candidate: string) => candidate === state,
      context: {
        first: {
          turnConfiguration: { model: 'claude-sonnet', effort: 'high', mode: 'default' },
        },
      },
    }),
  }
}

function insertSession(
  client: DatabaseSync,
  values: {
    id: string
    harness: string
    nativeId: string
    customTitle?: string | null
    preview?: string | null
    firstPrompt?: string | null
    cwd?: string | null
    updatedAt: number
  },
) {
  client
    .prepare(
      `INSERT INTO session (
        argo_id, harness, native_id, project_id, workspace_id, custom_title, preview,
        first_prompt, cwd, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      values.id,
      values.harness,
      values.nativeId,
      values.customTitle ?? null,
      values.preview ?? null,
      values.firstPrompt ?? null,
      values.cwd ?? null,
      values.updatedAt,
    )
}

test('returns exact numbered pages in deterministic Argo ID order', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[2],
      harness: 'claude',
      nativeId: 'shared-native-id',
      firstPrompt: 'third',
      updatedAt: 30,
    })
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'claude-native-id',
      firstPrompt: 'first',
      updatedAt: 10,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'shared-native-id',
      firstPrompt: 'second',
      updatedAt: 20,
    })

    const first = await list({ page: 1, pageSize: 2 })
    const second = await list({ page: 2, pageSize: 2 })

    assert.deepEqual(
      first.rows.map(({ id }) => id),
      [IDS[0], IDS[1]],
    )
    assert.deepEqual(
      second.rows.map(({ id }) => id),
      [IDS[2]],
    )
    assert.deepEqual(
      { page: first.page, pageSize: first.pageSize, total: first.total },
      { page: 1, pageSize: 2, total: 3 },
    )
    assert.equal(JSON.stringify(first).includes('native'), false)
    assert.equal(JSON.stringify(first).includes('cursor'), false)
    assert.equal(JSON.stringify(first).includes('managed'), false)
    assert.equal(JSON.stringify(first).includes('watched'), false)
  } finally {
    client.close()
  }
})

test('chooses custom title, vendor preview, then first prompt without reading history', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      customTitle: 'Custom title',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      cwd: '/work/one',
      updatedAt: 10,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'native-2',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      updatedAt: 20,
    })
    insertSession(client, {
      id: IDS[2],
      harness: 'claude',
      nativeId: 'native-3',
      firstPrompt: 'First prompt',
      updatedAt: 30,
    })

    const result = await list({ page: 1, pageSize: 10 })

    assert.deepEqual(
      result.rows.map(({ title }) => title),
      [
        { text: 'Custom title', source: 'custom' },
        { text: 'Vendor preview', source: 'summarised' },
        { text: 'First prompt', source: 'first-prompt' },
      ],
    )
    assert.equal(result.rows[0]?.cwd, '/work/one')
  } finally {
    client.close()
  }
})

test('adds the current live projection to a saved Session', async () => {
  const { client, list } = sessionListCaller({ [IDS[0]]: liveSession('Ready') })
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      firstPrompt: 'First prompt',
      updatedAt: 10,
    })

    const result = await list({ page: 1, pageSize: 10 })

    assert.deepEqual(
      {
        posture: result.rows[0]?.posture,
        status: result.rows[0]?.status,
        turnConfiguration: result.rows[0]?.turnConfiguration,
      },
      {
        posture: 'live',
        status: 'unknown',
        turnConfiguration: { model: 'claude-sonnet', effort: 'high', mode: 'default' },
      },
    )
  } finally {
    client.close()
  }
})

test('does not project a failed live channel as live', async () => {
  const { client, list } = sessionListCaller({ [IDS[0]]: liveSession('Failed') })
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      firstPrompt: 'First prompt',
      updatedAt: 10,
    })

    const result = await list({ page: 1, pageSize: 10 })

    assert.deepEqual(
      { posture: result.rows[0]?.posture, status: result.rows[0]?.status },
      { posture: null, status: 'unknown' },
    )
  } finally {
    client.close()
  }
})
