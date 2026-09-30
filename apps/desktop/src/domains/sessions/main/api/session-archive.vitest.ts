import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import { sessionArchiveProcedures } from './session-archive'
import { sessionListProcedure } from './session-list'
import { SessionRosterChanges } from './session-roster-changes'

const PROJECT = '00000000-0000-4000-8000-000000000011'
const SESSION = '00000000-0000-4000-8000-000000000010'

function caller() {
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
    subagents_read_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
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
  client
    .prepare(
      `INSERT INTO session (
        argo_id, harness, native_id, project_id, first_prompt, created_at, updated_at
      ) VALUES (?, 'claude', 'native-1', ?, 'hello', 1, 2)`,
    )
    .run(SESSION, PROJECT)
  const database = databaseFrom(client)
  const context = {
    database,
    roster: new SessionRosterChanges(),
    supervisor: {
      on: () => ({ unsubscribe: () => {} }),
      system: { get: () => undefined },
      getSnapshot: () => ({ context: { sessions: {}, starts: {} } }),
    } as never,
    watchedStatus: { statusOf: () => null },
  }
  return initTRPC
    .create()
    .router({
      ...sessionArchiveProcedures(context),
      sessionList: sessionListProcedure(context),
    })
    .createCaller({})
}

async function activeIds(api: ReturnType<typeof caller>) {
  const ids: string[] = []
  const stream = await api.sessionList({ projectId: PROJECT })
  stream
    .subscribe({
      next: (update) => {
        if (update.type === 'list') ids.push(...update.rows.map((row) => row.id))
      },
    })
    .unsubscribe()
  return ids
}

test('archiving moves a Session off the active roster and an unknown id fails', async () => {
  const api = caller()
  assert.deepEqual(await activeIds(api), [SESSION])
  const archived = await api.sessionArchiveSet({
    sessionIds: [SESSION, 'not-a-session'],
    archived: true,
  })
  assert.deepEqual(archived, { applied: [SESSION], failed: ['not-a-session'] })
  assert.deepEqual(await activeIds(api), [])
  const page = await api.sessionArchiveList({ projectId: PROJECT, cursor: null, restoreId: null })
  assert.deepEqual(
    page.sessions.map((session) => session.id),
    [SESSION],
  )
  assert.equal(page.sessions[0]?.archived, true)
  assert.equal(page.historyComplete, true)
  const restored = await api.sessionArchiveSet({ sessionIds: [SESSION], archived: false })
  assert.deepEqual(restored.applied, [SESSION])
  assert.deepEqual(await activeIds(api), [SESSION])
  await assert.rejects(() =>
    api.sessionArchiveList({ projectId: PROJECT, cursor: 'nope', restoreId: null }),
  )
})
