import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import { project } from '@/database/project/schema'
import { workspace } from '@/database/workspace/schema'
import type {
  SessionSummaryList,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { sessionSyncMachine } from './session-sync-machine'
import { knownSessionIds, matchSessionsToProjects, saveSessionBatch } from './session-sync-records'

const ID = '00000000-0000-4000-8000-000000000001'

function createDatabase() {
  const database = migratedDatabase()
  database
    .insert(project)
    .values({ id: 'project-1', path: '/repo', commonDirectory: '/repo/.git' })
    .run()
  database
    .insert(workspace)
    .values({
      id: 'workspace-1',
      projectId: 'project-1',
      kind: 'imported',
      displayName: 'feature',
      path: '/repo/worktree',
    })
    .run()
  return { client: database.$client, database }
}

test('matches cwd to the deepest registered Project root and keeps sparse metadata', () => {
  const { client, database } = createDatabase()
  try {
    const records = matchSessionsToProjects(database, [
      { nativeId: ID, preview: 'Summary', activityAt: 1, cwd: '/repo/worktree/src' },
    ])
    assert.deepEqual(records, [
      {
        nativeId: ID,
        activityAt: 1,
        preview: 'Summary',
        cwd: '/repo/worktree/src',
        projectId: 'project-1',
        workspaceId: 'workspace-1',
      },
    ])
    saveSessionBatch(database, 'claude', records)
    assert.deepEqual(
      Object.assign(
        {},
        client
          .prepare('SELECT project_id, workspace_id, custom_title, activity_at FROM session')
          .get(),
      ),
      { project_id: 'project-1', workspace_id: 'workspace-1', custom_title: null, activity_at: 1 },
    )
  } finally {
    client.close()
  }
})

test('saves the supplied batch', () => {
  const { client, database } = createDatabase()
  try {
    const records = Array.from({ length: 51 }, (_value, index) => ({
      nativeId: `native-${index}`,
    }))
    saveSessionBatch(database, 'claude', records)
    assert.equal(client.prepare('SELECT count(*) AS count FROM session').get()?.count, 51)
  } finally {
    client.close()
  }
})

test('returns the Argo ID of each saved record, keeping it on a second save', () => {
  const { client, database } = createDatabase()
  try {
    const first = saveSessionBatch(database, 'claude', [{ nativeId: 'one' }, { nativeId: 'two' }])
    const again = saveSessionBatch(database, 'claude', [{ nativeId: 'two' }])
    const stored = client
      .prepare('SELECT argo_id FROM session ORDER BY native_id')
      .all()
      .map((row) => row.argo_id)
    assert.deepEqual(first, stored)
    assert.deepEqual(again, [stored[1]])
  } finally {
    client.close()
  }
})

test('clears a removed custom title without replacing a known preview', () => {
  const { client, database } = createDatabase()
  try {
    saveSessionBatch(database, 'claude', [
      { nativeId: ID, customTitle: 'Pinned', preview: 'Earlier summary' },
    ])
    saveSessionBatch(database, 'claude', [
      {
        nativeId: ID,
        firstPrompt: 'First prompt',
        activityAt: 2,
        customTitle: null,
      },
    ])
    assert.deepEqual(
      Object.assign({}, client.prepare('SELECT custom_title, preview FROM session').get()),
      { custom_title: null, preview: 'Earlier summary' },
    )
  } finally {
    client.close()
  }
})

test('uses Harness and native ID together as Session identity', () => {
  const { client, database } = createDatabase()
  try {
    saveSessionBatch(database, 'claude', [{ nativeId: ID }])
    saveSessionBatch(database, 'codex', [{ nativeId: ID }])
    assert.equal(client.prepare('SELECT count(*) AS count FROM session').get()?.count, 2)
    assert.deepEqual(knownSessionIds(database, 'claude'), [ID])
    assert.deepEqual(knownSessionIds(database, 'codex'), [ID])
  } finally {
    client.close()
  }
})

test('keeps Codex Session identity while syncing title, preview, and cwd changes', () => {
  const { client, database } = createDatabase()
  try {
    saveSessionBatch(database, 'codex', [
      { nativeId: ID, customTitle: 'First title', preview: 'First preview', cwd: '/first' },
    ])
    const original = client.prepare('SELECT argo_id FROM session WHERE harness = ?').get('codex') as
      | { argo_id: string }
      | undefined
    saveSessionBatch(database, 'codex', [
      { nativeId: ID, customTitle: 'Renamed title', preview: 'Updated preview', cwd: '/second' },
    ])
    saveSessionBatch(database, 'codex', [
      { nativeId: ID, customTitle: null, preview: 'Latest preview', cwd: '/third' },
    ])
    const updated = client
      .prepare('SELECT argo_id, custom_title, preview, cwd FROM session WHERE harness = ?')
      .get('codex') as
      | { argo_id: string; custom_title: string | null; preview: string | null; cwd: string | null }
      | undefined
    assert.equal(original?.argo_id, updated?.argo_id)
    assert.deepEqual(Object.assign({}, updated), {
      argo_id: original?.argo_id,
      custom_title: null,
      preview: 'Latest preview',
      cwd: '/third',
    })
  } finally {
    client.close()
  }
})

test('keeps the first committed batch after the second batch exhausts retries', async () => {
  const { client, database } = createDatabase()
  const records = Array.from({ length: 51 }, (_value, index) => ({ nativeId: `native-${index}` }))
  let failedBatchAttempts = 0
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        fetch: fromPromise<
          SessionSummaryListResult,
          { knownNativeIds: string[]; listSessionSummaries: SessionSummaryList }
        >(async () => ({ records, skipped: 0 })),
        save: fromPromise(async ({ input }) => {
          if (input.records[0]?.nativeId === 'native-50') {
            failedBatchAttempts += 1
            throw new Error('Database unavailable')
          }
          saveSessionBatch(database, 'claude', input.records)
        }),
      },
    }),
    {
      input: {
        harness: 'claude',
        knownNativeIds: [],
        listSessionSummaries: async () => ({ records: [], skipped: 0 }),
      },
    },
  ).start()
  try {
    actor.send({ type: 'Start' })
    await waitFor(actor, (snapshot) => snapshot.matches('Failed'))
    assert.equal(client.prepare('SELECT count(*) AS count FROM session').get()?.count, 50)
    assert.equal(actor.getSnapshot().context.processed, 50)
    assert.equal(failedBatchAttempts, 3)
  } finally {
    actor.stop()
    client.close()
  }
})
