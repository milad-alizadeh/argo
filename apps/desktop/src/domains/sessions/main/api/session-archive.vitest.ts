import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import { sessionArchiveProcedures } from './session-archive'
import { sessionListProcedure } from './session-list'
import { SessionRosterChanges } from './session-roster-changes'

const PROJECT = '00000000-0000-4000-8000-000000000011'
const OTHER_PROJECT = '00000000-0000-4000-8000-000000000012'
const SESSION = '00000000-0000-4000-8000-000000000010'
const archivedId = (index: number) => `00000000-0000-4000-8000-1${String(index).padStart(11, '0')}`

function caller(archived: { projectId: string; activityAt: number }[] = []) {
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
  archived.forEach(({ projectId, activityAt }, index) => {
    client
      .prepare(
        `INSERT INTO session (
          argo_id, harness, native_id, project_id, first_prompt, activity_at, created_at, updated_at
        ) VALUES (?, 'claude', ?, ?, 'archived', ?, 1, 2)`,
      )
      .run(archivedId(index), `archived-${index}`, projectId, activityAt)
    client.prepare('INSERT INTO session_archive (session_id) VALUES (?)').run(archivedId(index))
  })
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

async function allArchivedPages(api: ReturnType<typeof caller>, projectId: string) {
  const ids: string[] = []
  let cursor: string | null = null
  do {
    const page = await api.sessionArchiveList({ projectId, cursor, restoreId: null })
    assert.ok(page.sessions.length <= 20)
    ids.push(...page.sessions.map((session) => session.id))
    cursor = page.nextCursor
  } while (cursor !== null)
  return ids
}

test('pages many archived Sessions newest first, one Project at a time', async () => {
  // Pairs share an activity time, so the Argo ID breaks the tie across a page boundary.
  const archived = Array.from({ length: 45 }, (_, index) => ({
    projectId: index % 3 === 2 ? OTHER_PROJECT : PROJECT,
    activityAt: 1_000 - Math.floor(index / 2),
  }))
  const api = caller(archived)
  const expected = (projectId: string) =>
    archived.flatMap((row, index) => (row.projectId === projectId ? [archivedId(index)] : []))
  const first = await api.sessionArchiveList({ projectId: PROJECT, cursor: null, restoreId: null })
  assert.equal(first.sessions.length, 20)
  assert.notEqual(first.nextCursor, null)
  assert.deepEqual(await allArchivedPages(api, PROJECT), expected(PROJECT))
  assert.deepEqual(await allArchivedPages(api, OTHER_PROJECT), expected(OTHER_PROJECT))
})

test('restores an archived Session by ID when it is not on a loaded page', async () => {
  const archived = Array.from({ length: 30 }, (_, index) => ({
    projectId: PROJECT,
    activityAt: 1_000 - index,
  }))
  const api = caller(archived)
  const oldest = archivedId(29)
  const page = await api.sessionArchiveList({ projectId: PROJECT, cursor: null, restoreId: oldest })
  assert.ok(!page.sessions.some((session) => session.id === oldest))
  assert.equal(page.restored?.id, oldest)
  assert.equal(page.restored?.archived, true)
  const elsewhere = await api.sessionArchiveList({
    projectId: OTHER_PROJECT,
    cursor: null,
    restoreId: oldest,
  })
  assert.equal(elsewhere.restored, null)
  const active = await api.sessionArchiveList({
    projectId: PROJECT,
    cursor: null,
    restoreId: SESSION,
  })
  assert.equal(active.restored, null)
})
