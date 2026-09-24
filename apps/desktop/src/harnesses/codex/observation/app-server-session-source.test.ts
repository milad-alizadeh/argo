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

test('reports an app-server history timeout', async () => {
  let complete: ((value: readonly SessionProjection[]) => void) | undefined
  let ready = 0
  const source = createCodexAppServerSessionSource({
    adapter: {
      execute: async () => ({ kind: 'rejected', reason: 'not used' }),
      subscribe: () => () => {},
    },
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
