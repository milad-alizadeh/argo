import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import { SETUP_DOCUMENT_REVISION } from '../../../../test-fixtures/projects/setup-document.fixture'

function openStore(databasePath: string) {
  const database = new Database(databasePath)
  const store = createProjectStore({
    exec: (source) => database.exec(source),
    prepare: (source) => database.query(source),
    close: () => database.close(),
  })
  return { database, store }
}

async function temporaryDatabase(context: { after: (callback: () => Promise<void>) => void }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-store-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  return path.join(directory, 'argo.sqlite')
}

test('keeps registered Projects and the selected Project after the store reopens', async (context) => {
  const databasePath = await temporaryDatabase(context)
  const { store: first } = openStore(databasePath)
  first.replace({
    projects: [{ id: 'project-1', path: '/tmp/example', commonDirectory: '/tmp/example/.git' }],
    selectedId: 'project-1',
  })
  first.close()

  const { store: reopened } = openStore(databasePath)
  assert.deepEqual(reopened.read(), {
    projects: [{ id: 'project-1', path: '/tmp/example', commonDirectory: '/tmp/example/.git' }],
    selectedId: 'project-1',
  })
  reopened.close()
})

test('refuses a Project row that does not meet the durable-store contract', async (context) => {
  const { database, store } = openStore(await temporaryDatabase(context))
  database
    .query('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
    .run('project-1', 'relative', '/tmp/example/.git')
  assert.throws(() => store.read())
  store.close()
})

test('keeps a setup checkpoint after the store reopens', async (context) => {
  const databasePath = await temporaryDatabase(context)
  const { store: first } = openStore(databasePath)
  first.writeSetupCheckpoint({
    projectId: 'project-1',
    worktreePath: '/tmp/project/.argo/worktrees/setup-project-1',
    phase: 'editing',
    configurationSource: '{"version":1}\n',
    documentRevision: SETUP_DOCUMENT_REVISION,
  })
  first.close()

  const { store: reopened } = openStore(databasePath)
  assert.deepEqual(reopened.readSetupCheckpoint('project-1'), {
    projectId: 'project-1',
    worktreePath: '/tmp/project/.argo/worktrees/setup-project-1',
    phase: 'editing',
    configurationSource: '{"version":1}\n',
    documentRevision: SETUP_DOCUMENT_REVISION,
  })
  reopened.close()
})

test('updates a Project path without discarding its setup checkpoint', async (context) => {
  const { store } = openStore(await temporaryDatabase(context))
  store.replace({
    projects: [{ id: 'project-1', path: '/tmp/project', commonDirectory: '/tmp/project/.git' }],
    selectedId: 'project-1',
  })
  store.writeSetupCheckpoint({
    projectId: 'project-1',
    worktreePath: '/tmp/project/.argo/worktrees/setup-project-1',
    phase: 'ready',
    configurationSource: '{"version":1}\n',
    documentRevision: SETUP_DOCUMENT_REVISION,
  })

  store.updateProjectPath('project-1', '/tmp/project/.argo/worktrees/setup-project-1')

  assert.equal(store.read().projects[0]?.path, '/tmp/project/.argo/worktrees/setup-project-1')
  assert.equal(store.readSetupCheckpoint('project-1')?.phase, 'ready')
  store.close()
})

test('adds configuration source to a checkpoint database from before manual setup', async (context) => {
  const databasePath = await temporaryDatabase(context)
  const database = new Database(databasePath)
  database.exec(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      common_directory TEXT NOT NULL UNIQUE
    ) STRICT;
    CREATE TABLE project_selection (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      project_id TEXT REFERENCES project(id)
    ) STRICT;
    CREATE TABLE project_setup_checkpoint (
      project_id TEXT PRIMARY KEY REFERENCES project(id),
      worktree_path TEXT NOT NULL,
      phase TEXT NOT NULL CHECK (phase IN ('editing', 'validating', 'ready', 'failed', 'cancelled'))
    ) STRICT;
  `)
  const store = createProjectStore({
    exec: (source) => database.exec(source),
    prepare: (source) => database.query(source),
    close: () => database.close(),
  })
  store.replace({
    projects: [{ id: 'project-1', path: '/tmp/project', commonDirectory: '/tmp/project/.git' }],
    selectedId: 'project-1',
  })
  store.writeSetupCheckpoint({
    projectId: 'project-1',
    worktreePath: '/tmp/project/.argo/worktrees/setup-project-1',
    phase: 'editing',
    configurationSource: '{"version":1}\n',
    documentRevision: SETUP_DOCUMENT_REVISION,
  })
  assert.equal(store.readSetupCheckpoint('project-1')?.configurationSource, '{"version":1}\n')
  assert.equal(store.readSetupCheckpoint('project-1')?.documentRevision, SETUP_DOCUMENT_REVISION)
  store.close()
})
