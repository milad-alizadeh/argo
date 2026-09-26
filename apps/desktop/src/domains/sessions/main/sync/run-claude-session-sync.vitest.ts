import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'vitest'
import { createActor, fromPromise, waitFor } from 'xstate'
import { databaseFrom } from '@/database/database'
import { fetchClaudeSessions, saveClaudeSessions } from './run-claude-session-sync'
import { type SyncResult, sessionSyncMachine } from './session-sync-machine'

const ID = '00000000-0000-4000-8000-000000000001'

function createDatabase() {
  const client = new DatabaseSync(':memory:')
  client.exec(`CREATE TABLE project (id TEXT PRIMARY KEY, path TEXT NOT NULL, common_directory TEXT NOT NULL, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE workspace (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL, display_name TEXT NOT NULL, path TEXT NOT NULL, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE session (argo_id TEXT PRIMARY KEY, harness TEXT NOT NULL, native_id TEXT NOT NULL, project_id TEXT, workspace_id TEXT, custom_title TEXT, preview TEXT, first_prompt TEXT, cwd TEXT, activity_at INTEGER, created_at INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL DEFAULT 1);
    CREATE UNIQUE INDEX session_harness_native ON session (harness, native_id);`)
  client.exec("INSERT INTO project VALUES ('project-1', '/repo', '/repo/.git', 1, 1);")
  client.exec(
    "INSERT INTO workspace VALUES ('workspace-1', 'project-1', 'imported', 'feature', '/repo/worktree', 1, 1);",
  )
  return { client, database: databaseFrom(client) }
}

test('matches cwd to the deepest registered Project root and keeps sparse metadata', async () => {
  const { client, database } = createDatabase()
  try {
    const records = await fetchClaudeSessions({
      database,
      reportMalformed: () => assert.fail('The record is valid.'),
      reader: {
        list: async () => [
          { sessionId: ID, summary: 'Summary', lastModified: 1, cwd: '/repo/worktree/src' },
        ],
        get: async () => undefined,
      },
    })
    assert.deepEqual(records, [
      {
        nativeId: ID,
        activityAt: 1,
        customTitle: null,
        preview: 'Summary',
        cwd: '/repo/worktree/src',
        projectId: 'project-1',
        workspaceId: 'workspace-1',
      },
    ])
    saveClaudeSessions(database, records)
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

test('saves the supplied batch in one commit', () => {
  const { client, database } = createDatabase()
  try {
    const records = Array.from({ length: 51 }, (_value, index) => ({
      nativeId: `native-${index}`,
    }))
    let commits = 0
    saveClaudeSessions(database, records, () => {
      commits += 1
    })
    assert.equal(commits, 1)
    assert.equal(client.prepare('SELECT count(*) AS count FROM session').get()?.count, 51)
  } finally {
    client.close()
  }
})

test('clears a removed Claude custom title without replacing a known preview', async () => {
  const { client, database } = createDatabase()
  try {
    saveClaudeSessions(database, [
      { nativeId: ID, customTitle: 'Pinned', preview: 'Earlier summary' },
    ])
    const records = await fetchClaudeSessions({
      database,
      reportMalformed: () => assert.fail('The record is valid.'),
      reader: {
        list: async () => [
          { sessionId: ID, summary: 'First prompt', firstPrompt: 'First prompt', lastModified: 2 },
        ],
        get: async () => undefined,
      },
    })
    saveClaudeSessions(database, records)
    assert.deepEqual(
      Object.assign({}, client.prepare('SELECT custom_title, preview FROM session').get()),
      { custom_title: null, preview: 'Earlier summary' },
    )
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
        fetch: fromPromise<SyncResult>(async () => ({ records, skipped: 0 })),
        save: fromPromise(async ({ input }) => {
          if (input.records[0]?.nativeId === 'native-50') {
            failedBatchAttempts += 1
            throw new Error('Database unavailable')
          }
          saveClaudeSessions(database, input.records)
        }),
      },
    }),
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
