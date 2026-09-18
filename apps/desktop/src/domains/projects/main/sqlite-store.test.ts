import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createProjectStore } from './sqlite-store'

test('keeps registered Projects and the selected Project after the store reopens', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-store-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const databasePath = path.join(directory, 'argo.sqlite')
  const firstDatabase = new Database(databasePath)
  const first = createProjectStore({
    exec: (source) => firstDatabase.exec(source),
    prepare: (source) => firstDatabase.query(source),
    close: () => firstDatabase.close(),
  })
  first.replace({
    projects: [{ id: 'project-1', path: '/tmp/example', commonDirectory: '/tmp/example/.git' }],
    selectedId: 'project-1',
  })
  first.close()

  const reopenedDatabase = new Database(databasePath)
  const reopened = createProjectStore({
    exec: (source) => reopenedDatabase.exec(source),
    prepare: (source) => reopenedDatabase.query(source),
    close: () => reopenedDatabase.close(),
  })
  assert.deepEqual(reopened.read(), {
    projects: [{ id: 'project-1', path: '/tmp/example', commonDirectory: '/tmp/example/.git' }],
    selectedId: 'project-1',
  })
  reopened.close()
})

test('refuses a Project row that does not meet the durable-store contract', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-store-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const database = new Database(path.join(directory, 'argo.sqlite'))
  const store = createProjectStore({
    exec: (source) => database.exec(source),
    prepare: (source) => database.query(source),
    close: () => database.close(),
  })
  database
    .query('INSERT INTO project (id, path, common_directory) VALUES (?, ?, ?)')
    .run('project-1', 'relative', '/tmp/example/.git')
  assert.throws(() => store.read())
  store.close()
})
