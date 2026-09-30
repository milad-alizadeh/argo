import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import type { z } from 'zod'
import { databaseFrom } from '@/database/database'
import { SessionActivities } from './session-activities'
import { sessionListProcedure, type sessionListUpdateSchema } from './session-list'
import { SessionRosterChanges } from './session-roster-changes'
import { WatchedSessionStatus } from './watched-session-status'

const IDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
] as const

function sessionListCaller(
  sessions: Record<string, unknown> = {},
  observeFeed?: (sessionId: string) => () => void,
) {
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
    activity_at INTEGER,
    list_order_at INTEGER NOT NULL DEFAULT 0,
    activity TEXT,
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
  );
  CREATE TABLE session_subagent (
    session_id TEXT NOT NULL,
    subagent_id TEXT NOT NULL,
    label TEXT,
    state TEXT NOT NULL,
    PRIMARY KEY (session_id, subagent_id)
  );
  CREATE TABLE session_archive (session_id TEXT PRIMARY KEY);`)
  const database = databaseFrom(client)
  const statusListeners = new Set<(event: { sessionId: string }) => void>()
  const supervisor = {
    on: (_type: string, listener: (event: { sessionId: string }) => void) => {
      statusListeners.add(listener)
      return { unsubscribe: () => statusListeners.delete(listener) }
    },
    system: { get: (id: string) => sessions[id] },
    getSnapshot: () => ({
      context: {
        sessions: Object.fromEntries(Object.keys(sessions).map((id) => [id, id])),
        starts: {},
      },
    }),
  }
  const roster = new SessionRosterChanges()
  const watchedStatus = new WatchedSessionStatus(() => roster.changed())
  const activities = new SessionActivities(database, () => roster.changed())
  const router = initTRPC.create().router({
    list: sessionListProcedure(
      {
        database,
        supervisor: supervisor as never,
        roster,
        watchedStatus,
      },
      observeFeed,
    ),
  })
  const caller = router.createCaller({})
  const updates = async (input: Parameters<typeof caller.list>[0]) => {
    const received: SessionListUpdate[] = []
    const stream = await caller.list(input)
    const subscription = stream.subscribe({ next: (update) => received.push(update) })
    return { received, stop: () => subscription.unsubscribe() }
  }
  const list = async (input: Parameters<typeof caller.list>[0]) => {
    const { received, stop } = await updates(input)
    stop()
    const [first] = received
    if (first?.type !== 'list') throw new Error('The roster did not send its list first.')
    return first
  }
  const statusChanged = (sessionId: string) => {
    for (const listener of statusListeners) listener({ sessionId })
  }
  return { client, list, updates, roster, statusChanged, watchedStatus, activities }
}

type SessionListUpdate = z.infer<typeof sessionListUpdateSchema>
const settled = () => new Promise((resolve) => setTimeout(resolve, 0))

function liveSession(state: string, status: string | null = null) {
  return {
    getSnapshot: () => ({
      value: state,
      matches: (candidate: string) => candidate === state,
      context: {
        status,
        turnConfiguration: { model: 'claude-sonnet', effort: 'high', mode: 'default' },
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
    workspaceId?: string | null
    activityAt?: number | null
    projectId?: string
    updatedAt: number
  },
) {
  client
    .prepare(
      `INSERT INTO session (
        argo_id, harness, native_id, project_id, workspace_id, custom_title, preview,
        first_prompt, cwd, activity_at, list_order_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
    .run(
      values.id,
      values.harness,
      values.nativeId,
      values.projectId ?? 'project-1',
      values.workspaceId ?? null,
      values.customTitle ?? null,
      values.preview ?? null,
      values.firstPrompt ?? null,
      values.cwd ?? null,
      values.activityAt ?? null,
      values.activityAt ?? values.updatedAt,
      values.updatedAt,
    )
}

type Caller = ReturnType<typeof sessionListCaller>

function updatesOfTwoSessions(client: DatabaseSync, updates: Caller['updates']) {
  insertSession(client, { id: IDS[0], harness: 'claude', nativeId: 'native-1', updatedAt: 20 })
  insertSession(client, { id: IDS[1], harness: 'claude', nativeId: 'native-2', updatedAt: 10 })
  return updates({ projectId: 'project-1', pageSize: 10 })
}

function listOneSession(client: DatabaseSync, list: Caller['list']) {
  insertSession(client, {
    id: IDS[0],
    harness: 'claude',
    nativeId: 'native-1',
    firstPrompt: 'First prompt',
    updatedAt: 10,
  })
  return list({ projectId: 'project-1', pageSize: 10 })
}

const statusesOf = (received: SessionListUpdate[]) =>
  received.map((update) =>
    update.type === 'row' ? update.row.status : update.rows.map((row) => row.status),
  )

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

test('returns the newest pages in list order with an Argo ID tie-breaker', async () => {
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

    const first = await list({ projectId: 'project-1', pages: 1, pageSize: 2 })
    const second = await list({ projectId: 'project-1', pages: 2, pageSize: 2 })

    assert.deepEqual(
      first.rows.map(({ id }) => id),
      [IDS[0], IDS[1]],
    )
    assert.deepEqual(
      second.rows.map(({ id }) => id),
      [IDS[0], IDS[1], IDS[2]],
    )
    assert.deepEqual(
      { pages: first.pages, pageSize: first.pageSize, total: first.total },
      { pages: 1, pageSize: 2, total: 3 },
    )
    assert.equal(JSON.stringify(first).includes('native'), false)
    assert.equal(JSON.stringify(first).includes('cursor'), false)
    assert.equal(JSON.stringify(first).includes('managed'), false)
    assert.equal(JSON.stringify(first).includes('watched'), false)
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
      updatedAt: 20,
    })
    insertSession(client, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'legacy-session',
      updatedAt: 10,
    })

    const result = await list({ projectId: 'project-1', pageSize: 10 })

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
    insertSession(client, {
      id: IDS[2],
      harness: 'claude',
      nativeId: 'native-3',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      updatedAt: 20,
    })
    insertSession(client, {
      id: '00000000-0000-4000-8000-000000000004',
      harness: 'claude',
      nativeId: 'native-4',
      preview: 'First prompt',
      firstPrompt: 'First prompt',
      updatedAt: 10,
    })
    insertTicketLink(client, {
      sessionId: IDS[1],
      projectId: 'project-1',
      key: '#2765',
      title: 'Ticket title',
      state: 'open',
    })

    const result = await list({ projectId: 'project-1', pageSize: 10 })

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

    const custom = await list({ projectId: 'project-1', search: 'CUSTOM', pageSize: 10 })
    const preview = await list({ projectId: 'project-1', search: 'preview', pageSize: 10 })
    const prompt = await list({ projectId: 'project-1', search: 'hidden', pageSize: 10 })

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

test('joins a Session to its Ticket as one nested ticket object', async () => {
  const { client, list } = sessionListCaller()
  try {
    insertSession(client, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      firstPrompt: 'Linked Session',
      updatedAt: 10,
    })
    insertTicketLink(client, {
      sessionId: IDS[0],
      projectId: 'project-1',
      key: '#2744',
      title: 'Simplify Session renderer state',
      state: 'open',
    })

    const result = await list({ projectId: 'project-1', pageSize: 10 })

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
    insertSession(client, { id: IDS[0], harness: 'codex', nativeId: 'native-1', updatedAt: 20 })
    insertSession(client, { id: IDS[1], harness: 'claude', nativeId: 'native-2', updatedAt: 10 })

    const result = await list({ projectId: 'project-1', pageSize: 10 })

    assert.deepEqual(
      result.rows.map(({ status }) => status),
      ['running', 'unknown'],
    )
  } finally {
    client.close()
  }
})

test('sends a changed row on its own when the roster announces a change', async () => {
  const { client, updates, roster } = sessionListCaller()
  try {
    const { received, stop } = await updatesOfTwoSessions(client, updates)

    client.prepare("UPDATE session SET custom_title = 'Renamed' WHERE argo_id = ?").run(IDS[1])
    roster.changed()
    roster.changed()
    await settled()
    stop()

    assert.deepEqual(
      received.map((update) => (update.type === 'row' ? update.row.customTitle : update.type)),
      ['list', 'Renamed'],
    )
  } finally {
    client.close()
  }
})

test('sends the whole list again when a change moves or adds rows', async () => {
  const { client, updates, roster } = sessionListCaller()
  try {
    const { received, stop } = await updatesOfTwoSessions(client, updates)

    client.prepare('UPDATE session SET list_order_at = 30 WHERE argo_id = ?').run(IDS[1])
    roster.changed()
    await settled()
    insertSession(client, { id: IDS[2], harness: 'codex', nativeId: 'native-3', updatedAt: 40 })
    roster.changed()
    await settled()
    stop()

    assert.deepEqual(
      received.map((update) =>
        update.type === 'list' ? update.rows.map(({ id }) => id) : update.type,
      ),
      [
        [IDS[0], IDS[1]],
        [IDS[1], IDS[0]],
        [IDS[2], IDS[1], IDS[0]],
      ],
    )
  } finally {
    client.close()
  }
})

test('sends a row whose live status changed without a roster announcement', async () => {
  let status = 'running'
  const session = {
    getSnapshot: () => ({
      value: 'Ready',
      matches: (candidate: string) => candidate === 'Ready',
      context: {
        status,
        first: { turnConfiguration: { model: null, effort: null, mode: null } },
      },
    }),
  }
  const { client, updates, statusChanged } = sessionListCaller({ [IDS[0]]: session })
  try {
    insertSession(client, { id: IDS[0], harness: 'claude', nativeId: 'native-1', updatedAt: 20 })
    const { received, stop } = await updates({ projectId: 'project-1', pageSize: 10 })

    status = 'idle'
    statusChanged(IDS[0])
    await settled()
    stop()

    assert.deepEqual(statusesOf(received), [['running'], 'idle'])
  } finally {
    client.close()
  }
})

test('stays quiet when a change leaves every row as it was', async () => {
  const { client, updates, roster } = sessionListCaller()
  try {
    insertSession(client, { id: IDS[0], harness: 'claude', nativeId: 'native-1', updatedAt: 20 })
    const { received, stop } = await updates({ projectId: 'project-1', pageSize: 10 })

    roster.changed()
    await settled()
    stop()

    assert.deepEqual(
      received.map(({ type }) => type),
      ['list'],
    )
  } finally {
    client.close()
  }
})

test('shows watched Codex history when an open live channel has no status', async () => {
  const { client, updates, roster, watchedStatus } = sessionListCaller({
    [IDS[0]]: liveSession('Ready'),
  })
  try {
    insertSession(client, { id: IDS[0], harness: 'codex', nativeId: 'native-1', updatedAt: 20 })
    const { received, stop } = await updates({ projectId: 'project-1', pageSize: 10 })

    watchedStatus.record({ harness: 'codex', nativeId: 'native-1', turn: 'open', at: Date.now() })
    roster.changed()
    await settled()
    watchedStatus.record({ harness: 'codex', nativeId: 'native-1', turn: null, at: Date.now() })
    roster.changed()
    await settled()
    watchedStatus.record({ harness: 'codex', nativeId: 'native-1', turn: 'closed', at: Date.now() })
    roster.changed()
    await settled()
    stop()

    assert.deepEqual(statusesOf(received), [['unknown'], 'running', 'idle'])
  } finally {
    watchedStatus.dispose()
    client.close()
  }
})

test('keeps a known live status ahead of watched history', async () => {
  const { client, list, watchedStatus } = sessionListCaller({
    [IDS[0]]: liveSession('Ready', 'idle'),
  })
  try {
    insertSession(client, { id: IDS[0], harness: 'codex', nativeId: 'native-1', updatedAt: 20 })
    watchedStatus.record({ harness: 'codex', nativeId: 'native-1', turn: 'open', at: Date.now() })

    assert.equal((await list({ projectId: 'project-1', pageSize: 10 })).rows[0]?.status, 'idle')
  } finally {
    watchedStatus.dispose()
    client.close()
  }
})

test('draws the activity the Session’s Feed published under its title', async () => {
  const { client, list, activities } = sessionListCaller()
  const activityOf = async () =>
    (await list({ projectId: 'project-1', pageSize: 10 })).rows.map((row) => row.activity)
  try {
    insertSession(client, { id: IDS[1], harness: 'claude', nativeId: 'native-2', updatedAt: 30 })

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

test('reads the Feed of a working Session only, and an idle row keeps its stored activity', async () => {
  const active = new Map<string, number>()
  const observeFeed = (sessionId: string) => {
    active.set(sessionId, (active.get(sessionId) ?? 0) + 1)
    return () => active.delete(sessionId)
  }
  const fixture = sessionListCaller({ [IDS[0]]: liveSession('Ready', 'running') }, observeFeed)
  const { client, updates, activities } = fixture
  try {
    for (const [index, id] of IDS.slice(0, 2).entries())
      insertSession(client, {
        id,
        harness: 'claude',
        nativeId: `native-${index}`,
        updatedAt: 20 - index,
      })
    activities.publish(IDS[1], { label: 'Ran bun test', kind: 'command', open: false })
    const { received, stop } = await updates({ projectId: 'project-1', pageSize: 10 })
    await settled()
    assert.deepEqual(active, new Map([[IDS[0], 1]]))
    const [first] = received
    assert.equal(first?.type === 'list' && first.rows[1]?.activity?.label, 'Ran bun test')
    stop()
    assert.equal(active.size, 0)
  } finally {
    client.close()
  }
})
