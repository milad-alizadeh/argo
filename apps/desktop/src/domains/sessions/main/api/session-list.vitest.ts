import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import { createSessionTicketLinkStoreFromDatabase } from '@/domains/tickets/main/session-links'
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
  ); CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);
  CREATE TABLE session_ticket_link (
    session_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    ticket_key TEXT NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT 1
  );`)
  const database = databaseFrom(client)
  const supervisor = {
    getSnapshot: () => ({ context: { sessions } }),
  }
  const router = initTRPC.create().router({
    list: sessionListProcedure({ database, supervisor: supervisor as never }),
  })
  return { client, database, list: router.createCaller({}).list }
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
    projectId?: string
    updatedAt: number
  },
) {
  client
    .prepare(
      `INSERT INTO session (
        argo_id, harness, native_id, project_id, workspace_id, custom_title, preview,
        first_prompt, cwd, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      values.id,
      values.harness,
      values.nativeId,
      values.projectId ?? 'project-1',
      values.customTitle ?? null,
      values.preview ?? null,
      values.firstPrompt ?? null,
      values.cwd ?? null,
      values.updatedAt,
    )
}

function insertRepeatedPromptSession(client: DatabaseSync) {
  insertSession(client, {
    id: '00000000-0000-4000-8000-000000000005',
    harness: 'claude',
    nativeId: 'native-5',
    preview: 'Repeated prompt',
    firstPrompt: 'Repeated prompt',
    updatedAt: 5,
  })
}

test('returns exact numbered pages in descending activity order with an Argo ID tie-breaker', async () => {
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

    insertSession(client, {
      id: '00000000-0000-4000-8000-000000000004',
      harness: 'claude',
      nativeId: 'other-project',
      projectId: 'project-2',
      firstPrompt: 'other project',
      updatedAt: 40,
    })

    const first = await list({ scope: 'project', projectId: 'project-1', page: 1, pageSize: 2 })
    const second = await list({ scope: 'project', projectId: 'project-1', page: 2, pageSize: 2 })

    assert.deepEqual(
      first.rows.map(({ id }) => id),
      [IDS[2], IDS[1]],
    )
    assert.deepEqual(
      second.rows.map(({ id }) => id),
      [IDS[0]],
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

test('chooses custom title, linked Ticket title, vendor preview, then first prompt without reading history', async () => {
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
      updatedAt: 40,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'native-2',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      updatedAt: 30,
    })
    client
      .prepare(
        `INSERT INTO session_ticket_link (session_id, project_id, ticket_key, title, state, created_at)
         VALUES (?, 'project-1', '2744', 'Linked Ticket title', 'open', '2026-01-01T00:00:00.000Z')`,
      )
      .run(IDS[1])
    insertSession(client, {
      id: IDS[2],
      harness: 'claude',
      nativeId: 'native-3',
      preview: 'Vendor preview',
      firstPrompt: 'Ignored first prompt',
      updatedAt: 20,
    })
    insertSession(client, {
      id: '00000000-0000-4000-8000-000000000004',
      harness: 'codex',
      nativeId: 'native-4',
      firstPrompt: 'First prompt',
      updatedAt: 10,
    })
    insertRepeatedPromptSession(client)

    const result = await list({ scope: 'project', projectId: 'project-1', page: 1, pageSize: 10 })

    assert.deepEqual(
      result.rows.map(({ title }) => title),
      [
        { text: 'Custom title', source: 'custom' },
        { text: 'Linked Ticket title', source: 'ticket' },
        { text: 'Vendor preview', source: 'summarised' },
        { text: 'First prompt', source: 'first-prompt' },
        { text: 'Repeated prompt', source: 'first-prompt' },
      ],
    )
    assert.equal(result.rows[0]?.cwd, '/work/one')
  } finally {
    client.close()
  }
})

test('lists every Session in the global scope, including a null Project link', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'project-one',
      firstPrompt: 'Project one',
      updatedAt: 10,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'project-two',
      projectId: 'project-2',
      firstPrompt: 'Project two',
      updatedAt: 20,
    })
    insertSession(client, {
      id: IDS[2],
      harness: 'claude',
      nativeId: 'no-project',
      projectId: undefined,
      firstPrompt: 'No Project',
      updatedAt: 30,
    })
    client.prepare(`UPDATE session SET project_id = NULL WHERE argo_id = ?`).run(IDS[2])

    const global = await list({ scope: 'global', page: 1, pageSize: 10 })
    const project = await list({ scope: 'project', projectId: 'project-1', page: 1, pageSize: 10 })

    assert.deepEqual(
      global.rows.map(({ id }) => id),
      [IDS[2], IDS[1], IDS[0]],
    )
    assert.equal(global.total, 3)
    assert.deepEqual(
      project.rows.map(({ id }) => id),
      [IDS[0]],
    )
  } finally {
    client.close()
  }
})

test('uses Argo ID to make equal activity times deterministic', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[1],
      harness: 'claude',
      nativeId: 'later-id',
      firstPrompt: 'Later ID',
      updatedAt: 10,
    })
    insertSession(client, {
      id: IDS[0],
      harness: 'codex',
      nativeId: 'earlier-id',
      firstPrompt: 'Earlier ID',
      updatedAt: 10,
    })

    const result = await list({ scope: 'project', projectId: 'project-1', page: 1, pageSize: 10 })

    assert.deepEqual(
      result.rows.map(({ id }) => id),
      [IDS[0], IDS[1]],
    )
  } finally {
    client.close()
  }
})

test('links a Ticket without copying its title to the Session row', async () => {
  const { client, database } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      firstPrompt: 'First prompt',
      updatedAt: 10,
    })

    await createSessionTicketLinkStoreFromDatabase(database).connect(
      IDS[0],
      { projectId: 'project-1', key: '2765', title: 'Linked Ticket title', state: 'open' },
      '2026-09-26T00:00:00.000Z',
    )

    assert.equal(
      client.prepare(`SELECT custom_title FROM session WHERE argo_id = ?`).get(IDS[0])
        ?.custom_title,
      null,
    )
  } finally {
    client.close()
  }
})

test('filters one Project by custom title and preview only', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      customTitle: 'Custom match',
      preview: 'Older summary',
      firstPrompt: 'Hidden first prompt',
      updatedAt: 10,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'native-2',
      preview: 'Preview match',
      firstPrompt: 'Another hidden prompt',
      updatedAt: 20,
    })

    const custom = await list({
      scope: 'project',
      projectId: 'project-1',
      search: 'CUSTOM',
      page: 1,
      pageSize: 10,
    })
    const preview = await list({
      scope: 'project',
      projectId: 'project-1',
      search: 'preview',
      page: 1,
      pageSize: 10,
    })
    const prompt = await list({
      scope: 'project',
      projectId: 'project-1',
      search: 'hidden',
      page: 1,
      pageSize: 10,
    })

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

    const result = await list({ scope: 'project', projectId: 'project-1', page: 1, pageSize: 10 })

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

    const result = await list({ scope: 'project', projectId: 'project-1', page: 1, pageSize: 10 })

    assert.deepEqual(
      { posture: result.rows[0]?.posture, status: result.rows[0]?.status },
      { posture: null, status: 'unknown' },
    )
  } finally {
    client.close()
  }
})
