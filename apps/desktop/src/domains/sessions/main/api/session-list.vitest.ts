import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { Database } from '@/database/database'
import {
  IDS,
  insertSession,
  linkTicket,
  liveSession,
  saveTicket,
  sessionListCaller,
} from '@/mocks/sessions/session-list-caller'
import { saveSessionSubagents } from '../database'
import { updateSession } from './session-update'

// Links a Session to a Ticket whose content the provider has saved.
function insertTicketLink(
  database: Database,
  {
    key,
    title,
    sessionId,
    createdAt,
  }: { sessionId: string; key: string; title: string; createdAt?: string },
) {
  saveTicket(database, { key, title })
  linkTicket(database, { sessionId, key, createdAt })
}

test('pages by sort order, then newest created, then Argo ID', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: '00000000-0000-4000-8000-000000000005',
      harness: 'claude',
      nativeId: 'moved-down',
      sortOrder: 1,
      createdAt: 50,
    })
    insertSession(database, { id: IDS[2], harness: 'claude', nativeId: 'older', createdAt: 10 })
    insertSession(database, { id: IDS[1], harness: 'codex', nativeId: 'tied-2', createdAt: 20 })
    insertSession(database, { id: IDS[0], harness: 'claude', nativeId: 'tied-1', createdAt: 20 })
    insertSession(database, {
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
    assert.deepEqual(first.rows.map(({ projectId, archived }) => ({ projectId, archived }))[0], {
      projectId: 'project-1',
      archived: false,
    })
    assert.equal(JSON.stringify(first).includes('native'), false)
  } finally {
    database.$client.close()
  }
})

test('counts every match on a page past the end', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, { id: IDS[0], nativeId: 'native-1', createdAt: 20 })
    insertSession(database, { id: IDS[1], nativeId: 'native-2', createdAt: 10 })

    const pastEnd = await list({ projectId: 'project-1', offset: 5, limit: 2 })
    const empty = await list({ projectId: 'project-2' })

    assert.deepEqual([pastEnd.total, pastEnd.rows], [2, []])
    assert.equal(empty.total, 0)
  } finally {
    database.$client.close()
  }
})

test('pages many archived Sessions apart from the active ones', async () => {
  const { database, list } = sessionListCaller()
  try {
    const archivedIds = Array.from(
      { length: 5 },
      (_, index) => `00000000-0000-4000-8000-00000000010${index}`,
    )
    for (const [index, id] of archivedIds.entries())
      insertSession(database, {
        id,
        harness: 'claude',
        nativeId: `archived-${index}`,
        createdAt: 100 - index,
        archived: true,
      })
    insertSession(database, { id: IDS[0], harness: 'claude', nativeId: 'active', createdAt: 200 })

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
    database.$client.close()
  }
})

test('projects each Session’s worktree, and null for one in the main checkout', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'linked-session',
      worktreePath: '/worktrees/one',
      worktreeBranch: 'argo/session-one',
      worktreeBase: 'main',
      createdAt: 20,
    })
    insertSession(database, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'project-root-session',
      createdAt: 10,
    })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(
      result.rows.map(({ worktree }) => worktree),
      [{ path: '/worktrees/one', branch: 'argo/session-one', base: 'main' }, null],
    )
  } finally {
    database.$client.close()
  }
})

test('names a Session by its custom title, then Ticket title, vendor preview and first prompt', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      customTitle: 'Custom title',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      cwd: '/work/one',
      createdAt: 40,
    })
    insertSession(database, {
      id: IDS[1],
      harness: 'codex',
      nativeId: 'native-2',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      createdAt: 30,
    })
    insertSession(database, {
      id: IDS[2],
      harness: 'claude',
      nativeId: 'native-3',
      preview: 'Vendor preview',
      firstPrompt: 'First prompt',
      createdAt: 20,
    })
    insertSession(database, {
      id: '00000000-0000-4000-8000-000000000004',
      harness: 'claude',
      nativeId: 'native-4',
      preview: 'First prompt',
      firstPrompt: 'First prompt',
      createdAt: 10,
    })
    insertTicketLink(database, { sessionId: IDS[1], key: '#2765', title: 'Ticket title' })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(
      result.rows.map(({ name }) => name),
      ['Custom title', 'Ticket title', 'Vendor preview', 'First prompt'],
    )
    assert.equal(result.rows[0]?.cwd, '/work/one')
  } finally {
    database.$client.close()
  }
})

test('joins a Session to its Ticket, whose state follows the provider with no link write', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: IDS[0],
      harness: 'claude',
      nativeId: 'native-1',
      firstPrompt: 'Linked Session',
      createdAt: 10,
    })
    insertTicketLink(database, {
      sessionId: IDS[0],
      key: '#2744',
      title: 'Simplify Session renderer state',
    })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(result.rows[0]?.ticket, {
      projectId: 'project-1',
      key: '#2744',
      title: 'Simplify Session renderer state',
      state: 'open',
      createdAt: '2026-09-26T10:00:00.000Z',
    })
    assert.equal(result.rows[0]?.name, 'Simplify Session renderer state')
    assert.equal('ticketKey' in (result.rows[0] ?? {}), false)

    saveTicket(database, { key: '#2744', title: 'Closed since', state: 'closed' })
    const closed = (await list({ projectId: 'project-1' })).rows[0]?.ticket
    assert.deepEqual([closed?.title, closed?.state], ['Closed since', 'closed'])
  } finally {
    database.$client.close()
  }
})

test('a linked Ticket with no saved content shows its key with no title or state', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: IDS[0],
      nativeId: 'native-1',
      firstPrompt: 'Prompt',
      createdAt: 10,
    })
    linkTicket(database, { sessionId: IDS[0], key: '#2744' })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(result.rows[0]?.ticket, {
      projectId: 'project-1',
      key: '#2744',
      title: null,
      state: null,
      createdAt: '2026-09-26T10:00:00.000Z',
    })
    assert.equal(result.rows[0]?.name, 'Prompt')
  } finally {
    database.$client.close()
  }
})

test('lists only one Ticket’s Sessions, most recently linked first, past the first page', async () => {
  const { database, list } = sessionListCaller()
  try {
    for (let index = 0; index < 35; index += 1)
      insertSession(database, {
        id: `00000000-0000-4000-8000-3${String(index).padStart(11, '0')}`,
        nativeId: `unlinked-${index}`,
        createdAt: 1_000 + index,
      })
    insertSession(database, { id: IDS[0], nativeId: 'linked-first', createdAt: 20 })
    insertSession(database, { id: IDS[1], nativeId: 'linked-later', createdAt: 10 })
    insertSession(database, { id: IDS[2], nativeId: 'other-ticket', createdAt: 30 })
    insertTicketLink(database, {
      sessionId: IDS[0],
      key: '#2937',
      title: 'Page the archive',
      createdAt: '2026-09-26T10:00:00.000Z',
    })
    insertTicketLink(database, {
      sessionId: IDS[1],
      key: '#2937',
      title: 'Page the archive',
      createdAt: '2026-09-27T10:00:00.000Z',
    })
    insertTicketLink(database, { sessionId: IDS[2], key: '#2938', title: 'Another Ticket' })

    const linked = await list({ projectId: 'project-1', ticketKey: '#2937', limit: 30 })

    assert.deepEqual(
      linked.rows.map(({ id }) => id),
      [IDS[1], IDS[0]],
    )
    assert.equal(linked.total, 2)
  } finally {
    database.$client.close()
  }
})

test('names a Session saved with an empty preview by its first prompt (#3077)', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: IDS[0],
      harness: 'codex',
      nativeId: 'native-1',
      preview: '',
      firstPrompt: 'First prompt',
    })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(
      result.rows.map(({ name }) => name),
      ['First prompt'],
    )
  } finally {
    database.$client.close()
  }
})

test('names a Session by its title, else its ID', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, {
      id: IDS[0],
      nativeId: 'native-1',
      firstPrompt: 'Prompt',
      createdAt: 30,
    })
    insertSession(database, { id: IDS[1], nativeId: 'native-2', createdAt: 20 })

    const result = await list({ projectId: 'project-1' })

    assert.deepEqual(
      result.rows.map(({ name }) => name),
      ['Prompt', IDS[1]],
    )
  } finally {
    database.$client.close()
  }
})

test.each([
  { state: 'Starting', live: null, stored: 'unknown', posture: 'live', status: 'starting' },
  { state: 'Sending', live: 'running', stored: 'unknown', posture: 'live', status: 'running' },
  { state: 'Ready', live: null, stored: 'unknown', posture: 'live', status: 'unknown' },
  { state: 'Ready', live: null, stored: 'running', posture: 'live', status: 'running' },
  { state: 'Ready', live: 'idle', stored: 'running', posture: 'live', status: 'idle' },
  { state: 'Failed', live: null, stored: 'unknown', posture: null, status: 'unknown' },
  { state: null, live: null, stored: 'idle', posture: null, status: 'idle' },
] as const)(
  'a $state channel with live status $live over stored $stored shows $status',
  async ({ state, live, stored, posture, status }) => {
    const { database, list } = sessionListCaller({
      sessions: state === null ? {} : { [IDS[0]]: liveSession(state, live) },
    })
    try {
      insertSession(database, { id: IDS[0], nativeId: 'native-1', status: stored, createdAt: 10 })

      const [row] = (await list({ projectId: 'project-1' })).rows

      assert.deepEqual(
        { posture: row?.posture, status: row?.status, effort: row?.turnConfiguration.effort },
        { posture, status, effort: posture === null ? null : 'high' },
      )
    } finally {
      database.$client.close()
    }
  },
)

test('a live channel’s Model, Effort and Mode outrank the stored ones, and stay once it is gone', async () => {
  const sessions: Record<string, unknown> = { [IDS[0]]: liveSession('Ready') }
  const { database, details, statusChanged, stopWatching } = sessionListCaller({ sessions })
  const live = { model: 'claude-sonnet', effort: 'high', mode: 'default' }
  try {
    insertSession(database, {
      id: IDS[0],
      nativeId: 'native-1',
      turnConfiguration: { model: null, effort: 'low', mode: null },
    })
    insertSession(database, {
      id: IDS[1],
      nativeId: 'native-2',
      turnConfiguration: { model: 'opus', effort: 'low', mode: null },
    })

    assert.deepEqual((await details({ sessionId: IDS[0] }))?.turnConfiguration, live)
    assert.deepEqual((await details({ sessionId: IDS[1] }))?.turnConfiguration, {
      model: 'opus',
      effort: 'low',
      mode: null,
    })

    statusChanged(IDS[0])
    delete sessions[IDS[0]]
    assert.deepEqual((await details({ sessionId: IDS[0] }))?.turnConfiguration, live)
  } finally {
    stopWatching()
    database.$client.close()
  }
})

test('draws the activity the Session’s Feed published under its title', async () => {
  const { database, list, sessionListChanges } = sessionListCaller()
  const context = { database, changes: sessionListChanges }
  const activityOf = async () =>
    (await list({ projectId: 'project-1' })).rows.map((row) => row.activity)
  try {
    insertSession(database, { id: IDS[1], harness: 'claude', nativeId: 'native-2', createdAt: 30 })

    updateSession(context, IDS[1], {
      activity: {
        label: 'Ran bun test',
        kind: 'command',
        open: true,
      },
    })
    assert.deepEqual(await activityOf(), [{ label: 'Ran bun test', kind: 'command', open: true }])
    updateSession(context, IDS[1], { activity: null })
    assert.deepEqual(await activityOf(), [null])
  } finally {
    database.$client.close()
  }
})

test('lists the Subagents a Session named', async () => {
  const { database, list } = sessionListCaller()
  try {
    insertSession(database, { id: IDS[0], harness: 'codex', nativeId: 'native-2', createdAt: 10 })
    saveSessionSubagents(database, IDS[0], [
      {
        kind: 'delegation',
        id: 'call-1',
        event: 'started',
        agentId: 'agent-1',
        status: 'running',
        name: 'Survey',
        prompt: null,
        model: null,
        summary: null,
      },
    ])

    assert.deepEqual((await list({ projectId: 'project-1' })).rows[0]?.subagents, [
      { id: 'agent-1', label: 'Survey', state: 'running' },
    ])
  } finally {
    database.$client.close()
  }
})

test('reads an archived Session by ID and says it is archived, and nothing for an unknown ID', async () => {
  const { database, details } = sessionListCaller()
  try {
    insertSession(database, { id: IDS[0], createdAt: 10, archived: true })

    const row = await details({ sessionId: IDS[0] })

    assert.deepEqual([row?.id, row?.archived], [IDS[0], true])
    assert.equal(await details({ sessionId: IDS[1] }), null)
  } finally {
    database.$client.close()
  }
})

for (const harness of ['claude', 'codex'] as const)
  test(`the list and the detail read return a linked ${harness} Session's Ticket, and none unlinked`, async () => {
    const { database, list, details } = sessionListCaller()
    try {
      insertSession(database, { id: IDS[0], harness, nativeId: 'linked', createdAt: 20 })
      insertSession(database, { id: IDS[1], harness, nativeId: 'unlinked', createdAt: 10 })
      insertTicketLink(database, { sessionId: IDS[0], key: '#2973', title: 'Join the Ticket' })

      const { rows } = await list({ projectId: 'project-1' })
      const linked = await details({ sessionId: IDS[0] })
      const unlinked = await details({ sessionId: IDS[1] })

      assert.deepEqual(
        rows.map(({ id, ticket }) => [id, ticket?.key ?? null, ticket?.title ?? null]),
        [
          [IDS[0], '#2973', 'Join the Ticket'],
          [IDS[1], null, null],
        ],
      )
      assert.deepEqual([linked?.ticket?.key, linked?.ticket?.title], ['#2973', 'Join the Ticket'])
      assert.equal(unlinked?.ticket, null)
    } finally {
      database.$client.close()
    }
  })
