import assert from 'node:assert/strict'
import { symlink } from 'node:fs/promises'
import path from 'node:path'
import { onTestFinished, test } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import type {
  SessionSummaryList,
  SessionSummaryListResult,
} from '@/domains/sessions/api/session-discovery'
import { insertProject, migratedDatabase } from '@/mocks/database/migrated-database'
import { addLinkedWorktree, worktreeRepoFixture } from '@/mocks/projects/worktree-repo.fixture'
import { sessionSyncMachine } from './session-sync-machine'
import { knownSessionIds, matchSessionsToProjects, saveSessionBatch } from './session-sync-records'

const ID = '00000000-0000-4000-8000-000000000001'

function createDatabase() {
  const database = migratedDatabase()
  insertProject(database, 'project-1', '/repo')
  return { client: database.$client, database }
}

test('matches cwd to its registered Project root and keeps sparse metadata', async () => {
  const { client, database } = createDatabase()
  try {
    const records = await matchSessionsToProjects(database, [
      { nativeId: ID, preview: 'Summary', activityAt: 1, cwd: '/repo/src' },
    ])
    assert.deepEqual(records, [
      { nativeId: ID, activityAt: 1, preview: 'Summary', cwd: '/repo/src', projectId: 'project-1' },
    ])
    saveSessionBatch(database, 'claude', records)
    assert.deepEqual(
      Object.assign(
        {},
        client
          .prepare('SELECT project_id, worktree_path, custom_title, activity_at FROM session')
          .get(),
      ),
      { project_id: 'project-1', worktree_path: null, custom_title: null, activity_at: 1 },
    )
  } finally {
    client.close()
  }
})

test('matches a Session in a linked worktree outside the Project folder to that Project', async () => {
  const { project } = await worktreeRepoFixture({ after: (cleanup) => onTestFinished(cleanup) })
  const linked = await addLinkedWorktree(project)
  const database = migratedDatabase()
  try {
    insertProject(database, 'project-git', project)
    const [record] = await matchSessionsToProjects(database, [{ nativeId: ID, cwd: linked }])
    assert.equal(record?.projectId, 'project-git')
  } finally {
    database.$client.close()
  }
})

test('matches a Session whose cwd reaches a linked worktree through a symlink', async () => {
  const { project } = await worktreeRepoFixture({ after: (cleanup) => onTestFinished(cleanup) })
  const linked = await addLinkedWorktree(project)
  const alias = path.join(path.dirname(project), 'alias')
  await symlink(linked, alias)
  const database = migratedDatabase()
  try {
    insertProject(database, 'project-git', project)
    const [record] = await matchSessionsToProjects(database, [{ nativeId: ID, cwd: alias }])
    assert.equal(record?.projectId, 'project-git')
  } finally {
    database.$client.close()
  }
})

test('a Session keeps its Project after its own worktree folder is gone', async () => {
  const { client, database } = createDatabase()
  try {
    client
      .prepare(
        "INSERT INTO session (argo_id, harness, native_id, project_id, worktree_path, worktree_branch, worktree_owned) VALUES ('session-1', 'codex', ?, 'project-1', '/elsewhere/gone', 'argo/gone', 1)",
      )
      .run(ID)
    const [record] = await matchSessionsToProjects(database, [{ nativeId: ID, cwd: '/elsewhere/gone' }])
    assert.equal(record?.projectId, 'project-1')
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

test('keeps the first committed batch when the second batch fails', async () => {
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
    assert.equal(failedBatchAttempts, 1)
  } finally {
    actor.stop()
    client.close()
  }
})

function storedTurnConfiguration(client: ReturnType<typeof createDatabase>['client']) {
  const row = client.prepare('SELECT turn_configuration FROM session').get() as {
    turn_configuration: string | null
  }
  return row.turn_configuration === null ? null : JSON.parse(row.turn_configuration)
}

test('saves a found Model and Effort, and keeps them when a later scan finds none', () => {
  const { client, database } = createDatabase()
  const found = { model: 'gpt-5.5', effort: 'high', mode: null }
  try {
    saveSessionBatch(database, 'codex', [{ nativeId: ID, activityAt: 1, turnConfiguration: found }])
    assert.deepEqual(storedTurnConfiguration(client), found)
    saveSessionBatch(database, 'codex', [{ nativeId: ID, activityAt: 2 }])
    assert.deepEqual(storedTurnConfiguration(client), found)
  } finally {
    client.close()
  }
})

test('keeps a live-saved Model and Effort when a later scan finds older ones', () => {
  const { client, database } = createDatabase()
  const live = { model: 'gpt-5.6', effort: 'low', mode: null }
  try {
    saveSessionBatch(database, 'codex', [{ nativeId: ID, activityAt: 1 }])
    client.prepare('UPDATE session SET turn_configuration = ?').run(JSON.stringify(live))
    saveSessionBatch(database, 'codex', [
      {
        nativeId: ID,
        activityAt: 2,
        turnConfiguration: { model: 'gpt-5.5', effort: 'high', mode: null },
      },
    ])
    assert.deepEqual(storedTurnConfiguration(client), live)
  } finally {
    client.close()
  }
})
