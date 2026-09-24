import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  SessionAdapter,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import { createCodexAppServerSessionSource } from './app-server-session-source'

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
})

test('searches Codex app-server history with one refresh', async () => {
  let refreshes = 0
  const source = createCodexAppServerSessionSource({
    adapter: mockAdapter(),
    projections: () => [],
    watchedProjections: () => [],
    refreshHistory: async () => {
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

test('reports an unknown Codex Session as missing after app-server history confirms its absence', async () => {
  const source = createCodexAppServerSessionSource({
    adapter: mockAdapter(),
    projections: () => [],
    watchedProjections: () => [],
    refreshHistory: async () => [],
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
    readHistoryProjection: async () => null,
    checkoutFor: () => null,
  })

  await assert.rejects(source.discoverSessions(), /app-server history did not answer/)
  complete?.([])
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(ready, 1)
})
