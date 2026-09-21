import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { SETUP_DOCUMENT_REVISION } from '../../../../test-fixtures/projects/setup-document.fixture'
import { createProjectStore } from './sqlite-store'

test('promotes the approved worktree and its checkpoint in one store transition', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-store-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const database = new Database(path.join(directory, 'argo.sqlite'))
  const store = createProjectStore(database)
  const worktreePath = '/tmp/project/.argo/worktrees/setup-project-1'
  store.replace({
    projects: [{ id: 'project-1', path: '/tmp/project', commonDirectory: '/tmp/project/.git' }],
    selectedId: 'project-1',
  })
  store.writeSetupCheckpoint({
    projectId: 'project-1',
    worktreePath,
    phase: 'validating',
    configurationSource: '',
    documentRevision: SETUP_DOCUMENT_REVISION,
  })

  store.promoteSetupWorktree('project-1', worktreePath)

  assert.equal(store.read().projects[0]?.path, worktreePath)
  assert.equal(store.readSetupCheckpoint('project-1')?.phase, 'ready')
  store.close()
})
