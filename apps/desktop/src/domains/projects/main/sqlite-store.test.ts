import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createProjectStore } from './sqlite-store'

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
    configurationSource: 'version = 1\n',
  })
  first.close()

  const { store: reopened } = openStore(databasePath)
  assert.deepEqual(reopened.readSetupCheckpoint('project-1'), {
    projectId: 'project-1',
    worktreePath: '/tmp/project/.argo/worktrees/setup-project-1',
    phase: 'editing',
    configurationSource: 'version = 1\n',
  })
  reopened.close()
})
