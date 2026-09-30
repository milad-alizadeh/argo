import assert from 'node:assert/strict'
import type { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import {
  IDS,
  insertSession,
  liveSession,
  sessionListCaller,
} from '@/mocks/sessions/session-list-caller'

type Caller = ReturnType<typeof sessionListCaller>

function listOneSession(client: DatabaseSync, list: Caller['list']) {
  insertSession(client, {
    id: IDS[0],
    harness: 'claude',
    nativeId: 'native-1',
    firstPrompt: 'First prompt',
    createdAt: 10,
  })
  return list({ projectId: 'project-1' })
}

function insertTicketLink(
  client: DatabaseSync,
  values: {
    sessionId: string
    projectId: string
    key: string
    title: string
    state: 'open' | 'closed'
  },
) {
  client
    .prepare(
      `INSERT INTO session_ticket_link (
        session_id, project_id, ticket_key, title, state, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      values.sessionId,
      values.projectId,
      values.key,
      values.title,
      values.state,
      '2026-09-26T10:00:00.000Z',
    )
}

test('pages by sort order, then newest created, then Argo ID', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: '00000000-0000-4000-8000-000000000005',
      harness: 'claude',
      nativeId: 'moved-down',
      sortOrder: 1,
      createdAt: 50,
    })
    insertSession(client, { id: IDS[2], harness: 'claude', nativeId: 'older', createdAt: 10 })
    insertSession(client, { id: IDS[1], harness: 'codex', nativeId: 'tied-2', createdAt: 20 })
    insertSession(client, { id: IDS[0], harness: 'claude', nativeId: 'tied-1', createdAt: 20 })
    insertSession(client, {
      id: '00000000-0000-4000-8000-000000000004',
      harness: 'claude',
      nativeId: 'other-project',
      projectId: 'project-2',
      createdAt: 40,
    })

    const first = await list({ projectId: 'project-1', limit: 2 })
    const second = await list({ projectId: 'project-1', offset: 2, limit: 2 })

    assert.deepEqual(
      [...first.rows, ...second.rows].map(({ id }) => id),
      [IDS[0], IDS[1], IDS[2], '00000000-0000-4000-8000-000000000005'],
    )
    assert.deepEqual([first.total, second.total], [4, 4])
    assert.deepEqual(
      first.rows.map(({ projectId, createdAt, sortOrder, archived }) => ({
        projectId,
        createdAt,
        sortOrder,
        archived,
      }))[0],
      {
        projectId: 'project-1',
        createdAt: new Date(20).toISOString(),
        sortOrder: 0,
        archived: false,
      },
    )
    assert.equal(JSON.stringify(first).includes('native'), false)
  } finally {
    client.close()
  }
})

test('pages many archived Sessions apart from the active ones', async () => {
  const { client, list } = sessionListCaller()
  try {
    const archivedIds = Array.from(
      { length: 5 },
      (_, index) => `00000000-0000-4000-8000-00000000010${index}`,
    )
    for (const [index, id] of archivedIds.entries())
      insertSession(client, {
        id,
        harness: 'claude',
        nativeId: `archived-${index}`,
        createdAt: 100 - index,
        archived: true,
      })
    insertSession(client, { id: IDS[0], harness: 'claude', nativeId: 'active', createdAt: 200 })

    const pages = await Promise.all(
      [0, 2, 4].map((offset) =>
        list({ projectId: 'project-1', filter: 'archived', offset, limit: 2 }),
      ),
    )
    const all = await list({ projectId: 'project-1', filter: 'all' })

    assert.deepEqual(
      pages.flatMap((page) => page.rows.map(({ id }) => id)),
      archivedIds,
    )
    assert.deepEqual(
      pages.map((page) => page.total),
      [5, 5, 5],
    )
    assert.equal(all.total, 6)
  } finally {
    client.close()
  }
})

test('projects the stored Workspace identity, including null for legacy Sessions', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'linked-session',
      workspaceId: 'workspace-1',
      createdAt: 20,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'legacy-session',
      createdAt: 10,
    })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(
      result.rows.map(({ workspaceId }) => workspaceId),
      ['workspace-1', null],
    )
  } finally {
    client.close()
  }
})

test('chooses custom title, Ticket title, distinct vendor preview, then first prompt', async () => {
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
      createdAt: 40,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'native-2',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      createdAt: 30,
    })
    insertSession(client, {
      id: IDS[2],
      harness: 'claude',
      nativeId: 'native-3',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      createdAt: 20,
    })
    insertSession(client, {
      id: '00000000-0000-4000-8000-000000000004',
      harness: 'claude',
      nativeId: 'native-4',
      preview: 'First prompt',
      firstPrompt: 'First prompt',
      createdAt: 10,
    })
    insertTicketLink(client, {
      sessionId: IDS[1],
      projectId: 'project-1',
      key: '#2765',
      title: 'Ticket title',
      state: 'open',
    })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(
      result.rows.map(({ title }) => title),
      [
        { text: 'Custom title', source: 'custom' },
        { text: 'Ticket title', source: 'ticket' },
        { text: 'Vendor preview', source: 'summarised' },
        { text: 'First prompt', source: 'first-prompt' },
      ],
    )
    assert.equal(result.rows[0]?.cwd, '/work/one')
  } finally {
    client.close()
  }
})

test('joins a Session to its Ticket as one nested ticket object', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      firstPrompt: 'Linked Session',
      createdAt: 10,
    })
    insertTicketLink(client, {
      sessionId: IDS[0],
      projectId: 'project-1',
      key: '#2744',
      title: 'Simplify Session renderer state',
      state: 'open',
    })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(result.rows[0]?.ticket, {
      projectId: 'project-1',
      key: '#2744',
      title: 'Simplify Session renderer state',
      state: 'open',
      createdAt: '2026-09-26T10:00:00.000Z',
    })
    assert.deepEqual(result.rows[0]?.title, {
      text: 'Simplify Session renderer state',
      source: 'ticket',
    })
    assert.equal(result.rows[0]?.customTitle, null)
    assert.equal('ticketKey' in (result.rows[0] ?? {}), false)
  } finally {
    client.close()
  }
})

async function savedSessionRowWithLiveState(state: string) {
  const { client, list } = sessionListCaller({ [IDS[0]]: liveSession(state) })
  try {
    const result = await listOneSession(client, list)
    return result.rows[0]
  } finally {
    client.close()
  }
}

test('adds the current live projection to a saved Session', async () => {
  const row = await savedSessionRowWithLiveState('Ready')
  assert.deepEqual(
    {
      posture: row?.posture,
      status: row?.status,
      turnConfiguration: row?.turnConfiguration,
    },
    {
      posture: 'live',
      status: 'unknown',
      turnConfiguration: { model: 'claude-sonnet', effort: 'high', mode: 'default' },
    },
  )
})

test('does not project a failed live channel as live', async () => {
  const row = await savedSessionRowWithLiveState('Failed')
  assert.deepEqual(
    { posture: row?.posture, status: row?.status },
    { posture: null, status: 'unknown' },
  )
})

test('projects the latest live status over the machine state, and unknown with no live actor', async () => {
  const { client, list } = sessionListCaller({ [IDS[0]]: liveSession('Sending', 'running') })
  try {
    insertSession(client, { id: IDS[0], harness: 'codex', nativeId: 'native-1', createdAt: 20 })
    insertSession(client, { id: IDS[1], harness: 'claude', nativeId: 'native-2', createdAt: 10 })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(
      result.rows.map(({ status }) => status),
      ['running', 'unknown'],
    )
  } finally {
    client.close()
  }
})

test('shows the stored status when the live channel has none, and the live status over it', async () => {
  const { client, list } = sessionListCaller({
    [IDS[0]]: liveSession('Ready'),
    [IDS[1]]: liveSession('Ready', 'idle'),
  })
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'codex',
      nativeId: 'native-1',
      status: 'running',
      createdAt: 30,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'native-2',
      status: 'running',
      createdAt: 20,
    })
    insertSession(client, { id: IDS[2], harness: 'claude', nativeId: 'native-3', createdAt: 10 })

    assert.deepEqual(
      (await list({ projectId: 'project-1' })).rows.map(({ status }) => status),
      ['running', 'idle', 'unknown'],
    )
  } finally {
    client.close()
  }
})

test('draws the activity the Session’s Feed published under its title', async () => {
  const { client, list, activities } = sessionListCaller()
  const activityOf = async () =>
    (await list({ projectId: 'project-1' })).rows.map((row) => row.activity)
  try {
    insertSession(client, { id: IDS[1], harness: 'claude', nativeId: 'native-2', createdAt: 30 })

    activities.publish(IDS[1], { label: 'Ran bun test', kind: 'command', open: true })
    assert.deepEqual(await activityOf(), [
      { label: 'Ran bun test', kind: 'command', open: true, tool: 'command', target: null },
    ])
    activities.publish(IDS[1], null)
    assert.deepEqual(await activityOf(), [null])
  } finally {
    client.close()
  }
})
