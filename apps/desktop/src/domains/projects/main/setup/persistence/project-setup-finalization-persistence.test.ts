import { Database } from 'bun:sqlite'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createProjectStore } from '@/domains/projects/main/sqlite-store'
import {
  acceptedPlanFixture,
  planFixture,
} from '../../../../../../test-fixtures/projects/setup/setup-plan.fixture'
import { createProjectSetupRegistry } from './project-setup-registry'

test('recovers a completed worktree promotion without promoting it twice after a crash', async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'argo-project-setup-finalization-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const databasePath = path.join(directory, 'argo.sqlite')
  const store = createProjectStore(new Database(databasePath))
  store.insertProject({ id: 'project-1', path: '/repo', commonDirectory: '/repo/.git' })
  const setup = createProjectSetupRegistry(store)
  const plan = planFixture()
  setup.transition('project-1', { type: 'Choose agent', harness: 'claude' })
  setup.transition('project-1', { type: 'Plan validated', plan })
  setup.transition('project-1', { type: 'Accept plan', acceptedPlan: acceptedPlanFixture(plan) })
  setup.transition('project-1', { type: 'Application completed', finalDiff: 'diff', progress: [] })
  setup.transition('project-1', { type: 'Approve final diff' })
  store.writeSetupCheckpoint({
    projectId: 'project-1',
    worktreePath: '/repo/.argo/worktrees/setup-project-1',
    phase: 'validating',
    configurationSource: '',
    documentRevision: 'revision-1',
  })
  store.promoteSetupWorktree('project-1', '/repo/.argo/worktrees/setup-project-1')
  store.close()

  const reopenedStore = createProjectStore(new Database(databasePath))
  const recovered = createProjectSetupRegistry(reopenedStore).snapshot('project-1')
  assert.equal(recovered.screen, 'ready')
  assert.equal(reopenedStore.read().projects[0]?.path, '/repo/.argo/worktrees/setup-project-1')
  assert.equal(reopenedStore.readSetupCheckpoint('project-1')?.phase, 'ready')
  reopenedStore.close()
})
