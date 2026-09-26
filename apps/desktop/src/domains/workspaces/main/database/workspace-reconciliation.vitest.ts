import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'
import { onTestFinished, test } from 'vitest'
import { databaseFrom } from '@/database/database'
import {
  addLinkedWorktree,
  workspaceRepoFixture,
} from '../../../../../test-fixtures/projects/workspaces/workspace-repo.fixture'
import { reconcileWorkspaces } from './workspace-reconciliation'

const run = promisify(execFile)

function database() {
  const client = new DatabaseSync(':memory:')
  client.exec(`
    CREATE TABLE workspace (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      display_name TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  onTestFinished(() => client.close())
  return databaseFrom(client)
}

function repositoryFixture() {
  return workspaceRepoFixture({ after: (cleanup) => onTestFinished(cleanup) })
}

test('registers the main checkout as one stable Workspace', async () => {
  const { project } = await repositoryFixture()
  const store = database()
  const workspaces = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  assert.equal(workspaces.length, 1)
  assert.equal(workspaces[0]?.kind, 'main')
  assert.equal(workspaces[0]?.path, project)
})

test('reconciling twice never mints a second main Workspace', async () => {
  const { project } = await repositoryFixture()
  const store = database()
  const first = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const second = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  assert.equal(second.length, 1)
  assert.equal(second[0]?.id, first[0]?.id)
})

test('imports an externally created linked worktree once', async () => {
  const { project } = await repositoryFixture()
  const linked = await addLinkedWorktree(project)
  const store = database()
  const first = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const second = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const imported = second.filter((candidate) => candidate.kind === 'imported')
  assert.equal(imported.length, 1)
  assert.equal(imported[0]?.path, linked)
  assert.equal(first.find((candidate) => candidate.kind === 'imported')?.id, imported[0]?.id)
})

test('a branch checkout inside an imported Workspace never creates a new identity', async () => {
  const { project } = await repositoryFixture()
  const linked = await addLinkedWorktree(project)
  const store = database()
  const before = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const beforeImported = before.find((candidate) => candidate.kind === 'imported')
  await run('git', ['-C', linked, 'checkout', '-b', 'renamed'])
  const after = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const afterImported = after.find((candidate) => candidate.kind === 'imported')
  assert.equal(after.length, before.length)
  assert.equal(afterImported?.id, beforeImported?.id)
  assert.equal(afterImported?.path, linked)
})
