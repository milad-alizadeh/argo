import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  SessionAdapter,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import { createCodexAppServerSessionSource } from './app-server-session-source'
import { discovery } from './codex-history-rows'

function projection(): SessionProjection {
  return {
    session: { harness: 'codex', nativeId: 'thread-1' },
    posture: 'managed',
    sourceHealth: 'ready',
    revision: 4,
    workspace: { id: 'workspace-1' },
    status: 'running',
    title: 'Inspect the migration',
    turns: [{ id: 'turn-1', status: 'running', startedAt: 1_700_000_000_000, completedAt: null }],
    messages: [{ id: 'message-1', turnId: 'turn-1', role: 'user', text: 'Replace the driver.' }],
    toolCalls: [{ id: 'tool-1', turnId: 'turn-1', name: 'shell', status: 'running' }],
    pendingApprovals: [],
    pendingQuestions: [],
    usage: { inputTokens: 12, outputTokens: 34 },
  }
}

function mockAdapter(): SessionAdapter {
  return {
    execute: async () => ({ kind: 'rejected', reason: 'not used' }),
    subscribe: () => () => {},
  }
}

async function assertRenameForwarded(
  source: ReturnType<typeof createCodexAppServerSessionSource>,
  commands: unknown[],
) {
  assert.deepEqual(
    await source.rename({
      version: 1,
      type: 'session.rename',
      requestId: 'request-1',
      sessionId: 'thread-1',
      name: 'Renamed by Argo',
    }),
    {
      version: 1,
      type: 'session.renamed',
      requestId: 'request-1',
      sessionId: 'thread-1',
      title: 'Renamed by Argo',
    },
  )
  assert.deepEqual(commands, [
    {
      type: 'session.rename',
      session: { harness: 'codex', nativeId: 'thread-1' },
      title: 'Renamed by Argo',
    },
  ])
}

test('projects managed Codex app-server state with its watched history', async () => {
  const commands: unknown[] = []
  const source = createCodexAppServerSessionSource({
    adapter: {
      execute: async (command) => {
        commands.push(command)
        return { kind: 'accepted', projection: projection() }
      },
      subscribe: () => () => {},
    } satisfies SessionAdapter,
    projections: () => [projection()],
    watchedProjections: () => [{ ...projection(), posture: 'watched' }],
    refreshHistory: async () => [{ ...projection(), posture: 'watched' }],
    refreshSearchHistory: async () => [{ ...projection(), posture: 'watched' }],
    readHistoryProjection: async () => ({ ...projection(), posture: 'watched' }),
    checkoutFor: () => null,
  })

  const listed = await source.discoverSessions()
  assert.equal(listed.rows[0]?.id, 'thread-1')
  assert.equal(listed.rows[0]?.posture, 'managed')
  assert.equal(listed.rows[0]?.title?.text, 'Inspect the migration')
  assert.equal(listed.rows[0]?.turnStartedAt, new Date(1_700_000_000_000).toISOString())
  assert.equal(listed.rows[0]?.updatedAt, new Date(1_700_000_000_000).toISOString())
  assert.equal(source.managedSessions?.()[0]?.posture, 'managed')

  assert.deepEqual(source.readManagedFeed?.('thread-1'), {
    chainId: 'thread-1',
    revision: '4',
    rows: [
      { shape: 'prose', id: 'message-1', role: 'user', text: 'Replace the driver.' },
      {
        shape: 'tool',
        id: 'tool-1',
        kind: 'tool',
        label: 'shell',
        lineCounts: null,
        status: 'running',
        evidence: null,
        text: null,
      },
    ],
  })

  await assertRenameForwarded(source, commands)
})

test('searches Codex app-server history with one refresh', async () => {
  let refreshes = 0
  const source = createCodexAppServerSessionSource({
    adapter: mockAdapter(),
    projections: () => [],
    watchedProjections: () => [],
    refreshHistory: async () => [],
    refreshSearchHistory: async () => {
      refreshes += 1
      return [projection()]
    },
    readHistoryProjection: async () => null,
    checkoutFor: () => null,
  })

  const matches = await source.searchSessions?.('migration')
  assert.deepEqual(
    matches?.map((row) => row.id),
    ['thread-1'],
  )
  assert.equal(refreshes, 1)
  assert.equal(await source.historyComplete?.(), true)
})

test('finds a Codex Session omitted by a nonempty state database', async () => {
  let repairedReads = 0
  const source = createCodexAppServerSessionSource({
    adapter: mockAdapter(),
    projections: () => [],
    watchedProjections: () => [],
    refreshHistory: async () => [projection()],
    refreshSearchHistory: async () => {
      repairedReads += 1
      return [
        projection(),
        {
          ...projection(),
          session: { harness: 'codex', nativeId: 'repaired' },
          title: 'Repaired match',
        },
      ]
    },
    readHistoryProjection: async () => null,
    checkoutFor: () => null,
  })

  assert.deepEqual(
    (await source.searchSessions?.('Repaired'))?.map((row) => row.id),
    ['repaired'],
  )
  assert.equal(repairedReads, 1)
  assert.equal(await source.historyComplete?.(), true)
})

test('reports an unknown Codex Session as missing after app-server history confirms its absence', async () => {
  const source = createCodexAppServerSessionSource({
    adapter: mockAdapter(),
    projections: () => [],
    watchedProjections: () => [],
    refreshHistory: async () => [],
    refreshSearchHistory: async () => [],
    readHistoryProjection: async () => {
      throw new Error('thread/read failed')
    },
    checkoutFor: () => null,
  })

  assert.equal(await source.readObservedFeed?.('not-a-session'), null)
})

test('reports an app-server history timeout', async () => {
  let complete: ((value: readonly SessionProjection[]) => void) | undefined
  let ready = 0
  const source = createCodexAppServerSessionSource({
    adapter: mockAdapter(),
    projections: () => [],
    watchedProjections: () => [],
    refreshHistory: (notifyLateSuccess) =>
      new Promise<readonly SessionProjection[]>((resolve) => {
        complete = (value) => {
          if (notifyLateSuccess()) ready += 1
          resolve(value)
        }
      }),
    refreshSearchHistory: async () => [],
    readHistoryProjection: async () => null,
    checkoutFor: () => null,
  })

  await assert.rejects(source.discoverSessions(), /app-server history did not answer/)
  complete?.([])
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(ready, 1)
})

test('reports missing Codex timestamps and filters rows without titles or with relay output', async () => {
  const valid = projection()
  const relay = {
    ...projection(),
    session: { harness: 'codex' as const, nativeId: 'relay' },
    title: null,
    messages: [
      {
        id: 'relay-message',
        turnId: 'turn-1',
        role: 'user' as const,
        text: 'AGENT OUTPUT: warm-up',
      },
    ],
  }
  const missingTimestamp = {
    ...projection(),
    session: { harness: 'codex' as const, nativeId: 'missing-timestamp' },
    turns: [],
  }
  const missingTitle = {
    ...projection(),
    session: { harness: 'codex' as const, nativeId: 'missing-title' },
    title: null,
    messages: [],
  }
  const records = [valid, relay, missingTimestamp, missingTitle]
  const source = createCodexAppServerSessionSource({
    adapter: {
      execute: async () => ({ kind: 'rejected', reason: 'not used' }),
      subscribe: () => () => {},
    },
    projections: () => records,
    watchedProjections: () => [],
    refreshHistory: async () => records,
    refreshSearchHistory: async () => records,
    readHistoryProjection: async () => null,
    checkoutFor: () => null,
  })

  const result = await source.discoverSessions()

  assert.deepEqual(
    result.rows.map((row) => row.id),
    ['thread-1', 'missing-timestamp'],
  )
  assert.equal(result.rows[1]?.updatedAt, null)
  assert.equal(result.filesFound, 4)
  assert.equal(result.filesRead, 4)
  assert.equal(result.filesUnreadable, 3)
  assert.equal(result.filesParsed, 2)
  assert.equal(result.historyComplete, false)
  assert.deepEqual(
    source.managedSessions?.().map((row) => row.id),
    ['thread-1', 'missing-timestamp'],
  )
})

test('limits repeated Codex boundary warnings while retaining unreadable counts', () => {
  const originalWarn = console.warn
  const originalNow = Date.now
  const warnings: unknown[][] = []
  let now = originalNow() + 31_000
  Date.now = () => now
  console.warn = (...values: unknown[]) => warnings.push(values)
  try {
    const invalid = { ...projection(), turns: [] }
    let records: SessionProjection[] = [
      { ...invalid, session: { ...invalid.session, nativeId: 'invalid-1' } },
    ]
    const first = discovery(records, () => null)
    records = [
      { ...invalid, session: { ...invalid.session, nativeId: 'invalid-2' } },
      { ...invalid, session: { ...invalid.session, nativeId: 'invalid-3' } },
    ]
    const second = discovery(records, () => null)
    assert.equal(first.filesUnreadable, 1)
    assert.equal(second.filesUnreadable, 2)
    assert.equal(warnings.length, 1)
    assert.deepEqual(warnings[0], [
      'Codex app-server Session records have boundary issues',
      { unreadable: 1, missingTitle: 0, invalidTimestamp: 1, relayOutput: 0 },
    ])

    now += 30_000
    const later = discovery(records, () => null)
    assert.equal(later.filesUnreadable, 2)
    assert.equal(warnings.length, 2)
    assert.deepEqual(warnings[1]?.[1], {
      unreadable: 2,
      missingTitle: 0,
      invalidTimestamp: 2,
      relayOutput: 0,
    })
  } finally {
    Date.now = originalNow
    console.warn = originalWarn
  }
})
