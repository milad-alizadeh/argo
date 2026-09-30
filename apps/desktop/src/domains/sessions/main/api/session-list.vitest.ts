import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  IDS,
  insertOrderedSessions,
  insertSession,
  insertTicketLink,
  listOneSession,
  liveSession,
  sessionListCaller,
  settled,
} from '@/mocks/sessions/session-list-caller.fixture'
import type { SessionActivities } from './session-activities'

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

    const result = await list({ projectId: 'project-1', after: 10 })

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

    const result = await list({ projectId: 'project-1', after: 10 })

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

    const custom = await list({ projectId: 'project-1', search: 'CUSTOM', after: 10 })
    const preview = await list({ projectId: 'project-1', search: 'preview', after: 10 })
    const prompt = await list({ projectId: 'project-1', search: 'hidden', after: 10 })

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

    const result = await list({ projectId: 'project-1', after: 10 })

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

    const result = await list({ projectId: 'project-1', after: 10 })

    assert.deepEqual(
      result.rows.map(({ status }) => status),
      ['running', 'unknown'],
    )
  } finally {
    client.close()
  }
})

test('invalidates once after attaching, then once per burst of changes', async () => {
  const { client, changes, roster, statusChanged } = sessionListCaller()
  try {
    const { received, stop } = await changes()
    const initial = [...received]
    roster.changed()
    roster.changed()
    await settled()
    statusChanged(IDS[0])
    await settled()
    stop()
    roster.changed()
    await settled()

    assert.deepEqual(initial, ['invalidated'])
    assert.deepEqual(received, ['invalidated', 'invalidated', 'invalidated'])
  } finally {
    client.close()
  }
})

test('shows watched Codex history when an open live channel has no status', async () => {
  const { client, list, watchedStatus } = sessionListCaller({ [IDS[0]]: liveSession('Ready') })
  try {
    insertSession(client, { id: IDS[0], harness: 'codex', nativeId: 'native-1', updatedAt: 20 })
    const status = async () => (await list({ projectId: 'project-1' })).rows[0]?.status
    const statuses = [await status()]
    for (const turn of ['open', null, 'closed'] as const) {
      watchedStatus.record({ harness: 'codex', nativeId: 'native-1', turn, at: Date.now() })
      statuses.push(await status())
    }

    assert.deepEqual(statuses, ['unknown', 'running', 'running', 'idle'])
  } finally {
    watchedStatus.dispose()
    client.close()
  }
})

test('holds temporary Feed readers only for the latest window of an attached view', async () => {
  const open = new Set<string>()
  const { client, list, changes, observers } = sessionListCaller({}, (sessionId) => {
    open.add(sessionId)
    return () => open.delete(sessionId)
  })
  try {
    const ids = insertOrderedSessions(client, 40)
    await list({ projectId: 'project-1', after: 10 })
    const unattached = open.size

    const { stop } = await changes()
    await list({ projectId: 'project-1', after: 10 })
    const top = new Set(open)
    const deep = ids[25]
    assert.ok(deep !== undefined)
    await list({
      projectId: 'project-1',
      anchor: { kind: 'key', listOrderAt: 10_000 - 25, id: deep },
      before: 5,
      after: 5,
    })
    const down = new Set(open)
    await list({ projectId: 'project-1', after: 10 })
    const up = new Set(open)
    stop()

    assert.equal(unattached, 0)
    assert.deepEqual([...top], ids.slice(0, 10))
    assert.deepEqual([...down].sort(), ids.slice(20, 30).sort())
    assert.deepEqual([...up].sort(), ids.slice(0, 10).sort())
    assert.equal(open.size, 0)
    assert.equal(observers.size, 0)
  } finally {
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

    assert.equal((await list({ projectId: 'project-1' })).rows[0]?.status, 'idle')
  } finally {
    watchedStatus.dispose()
    client.close()
  }
})

test('draws the activity the Session’s Feed published under its title', async () => {
  const { client, list, activities } = sessionListCaller()
  const activityOf = async () =>
    (await list({ projectId: 'project-1', after: 10 })).rows.map((row) => row.activity)
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

test('keeps available activity for every visible Session while switching Feeds', async () => {
  const active = new Map<string, number>()
  let activities: SessionActivities
  const observeFeed = (sessionId: string) => {
    active.set(sessionId, (active.get(sessionId) ?? 0) + 1)
    activities.publish(sessionId, {
      label: `Activity for ${sessionId}`,
      kind: 'thought',
      open: true,
    })
    return () => {
      const remaining = (active.get(sessionId) ?? 1) - 1
      if (remaining === 0) {
        active.delete(sessionId)
        activities.publish(sessionId, null)
      } else active.set(sessionId, remaining)
    }
  }
  const fixture = sessionListCaller({}, observeFeed)
  activities = fixture.activities
  const { client, list, changes } = fixture
  try {
    for (const [index, id] of IDS.slice(0, 2).entries())
      insertSession(client, {
        id,
        harness: 'claude',
        nativeId: `native-${index}`,
        updatedAt: 20 - index,
      })
    const { stop } = await changes()
    await list({ projectId: 'project-1', after: 10 })
    assert.deepEqual(active, new Map(IDS.slice(0, 2).map((id) => [id, 1])))
    assert.deepEqual(
      (await list({ projectId: 'project-1', after: 10 })).rows.map((row) => row.activity?.label),
      IDS.slice(0, 2).map((id) => `Activity for ${id}`),
    )
    const leaveSelectedFeed = observeFeed(IDS[0])
    leaveSelectedFeed()
    assert.equal(activities.activityOf(IDS[0])?.label, `Activity for ${IDS[0]}`)
    stop()
    assert.equal(active.size, 0)
  } finally {
    client.close()
  }
})
