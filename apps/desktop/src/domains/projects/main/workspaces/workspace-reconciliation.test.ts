import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import {
  addLinkedWorktree,
  workspaceRepoFixture,
} from '../../../../../test-fixtures/projects/workspaces/workspace-repo.fixture'
import { reconcileWorkspaces } from './workspace-reconciliation'
import type { WorkspaceRecord, WorkspaceStore } from './workspace-store'

const run = promisify(execFile)

function memoryStore(): WorkspaceStore {
  const workspaces = new Map<string, WorkspaceRecord>()
  const selections = new Map<string, string>()
  const recoveries = new Map<string, { workspaceId: string; checkoutRemovedAt: string }>()
  return {
    readWorkspaces: (projectId) =>
      [...workspaces.values()].filter((candidate) => candidate.projectId === projectId),
    writeWorkspace: (record) => workspaces.set(record.id, record),
    selectWorkspace: (projectId, workspaceId) => selections.set(projectId, workspaceId),
    readWorkspaceSelection: (projectId) => selections.get(projectId) ?? null,
    writeManagedWorkspaceRecovery: (recovery) => recoveries.set(recovery.workspaceId, recovery),
    readManagedWorkspaceRecovery: (workspaceId) => recoveries.get(workspaceId) ?? null,
  }
}

test('registers the main checkout as one stable Workspace', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const store = memoryStore()

  const workspaces = await reconcileWorkspaces(store, { id: 'project-1', path: project })

  assert.equal(workspaces.length, 1)
  assert.equal(workspaces[0]?.kind, 'main')
  assert.equal(workspaces[0]?.path, project)
})

test('reconciling twice never mints a second main Workspace', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const store = memoryStore()

  const first = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const second = await reconcileWorkspaces(store, { id: 'project-1', path: project })

  assert.equal(second.length, 1)
  assert.equal(second[0]?.id, first[0]?.id)
})

test('imports an externally created linked worktree once', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const linked = await addLinkedWorktree(project)
  const store = memoryStore()

  const first = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const second = await reconcileWorkspaces(store, { id: 'project-1', path: project })

  const imported = second.filter((candidate) => candidate.kind === 'imported')
  assert.equal(imported.length, 1)
  assert.equal(imported[0]?.path, linked)
  assert.equal(first.find((candidate) => candidate.kind === 'imported')?.id, imported[0]?.id)
})

test('a branch checkout inside an imported Workspace never creates a new identity', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const linked = await addLinkedWorktree(project)
  const store = memoryStore()
  const before = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const beforeImported = before.find((candidate) => candidate.kind === 'imported')

  await run('git', ['-C', linked, 'checkout', '-b', 'renamed'])
  const after = await reconcileWorkspaces(store, { id: 'project-1', path: project })
  const afterImported = after.find((candidate) => candidate.kind === 'imported')

  assert.equal(after.length, before.length)
  assert.equal(afterImported?.id, beforeImported?.id)
  assert.equal(afterImported?.path, linked)
})

test('records recovery for a managed Workspace whose checkout is gone', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const store = memoryStore()
  store.writeWorkspace({
    id: 'workspace-managed',
    projectId: 'project-1',
    kind: 'managed',
    displayName: 'argo/workspace-managed',
    path: path.join(project, '.argo', 'worktrees', 'workspace-managed'),
    baseRef: 'main',
  })

  await reconcileWorkspaces(store, { id: 'project-1', path: project })

  assert.notEqual(store.readManagedWorkspaceRecovery('workspace-managed'), null)
})

test('a managed Workspace recovered before is not re-recorded', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const store = memoryStore()
  const managedPath = path.join(project, '.argo', 'worktrees', 'workspace-managed')
  store.writeWorkspace({
    id: 'workspace-managed',
    projectId: 'project-1',
    kind: 'managed',
    displayName: 'argo/workspace-managed',
    path: managedPath,
    baseRef: 'main',
  })
  const first = () => new Date('2026-01-01T00:00:00.000Z')
  await reconcileWorkspaces(store, { id: 'project-1', path: project }, first)

  const second = () => new Date('2026-06-01T00:00:00.000Z')
  await reconcileWorkspaces(store, { id: 'project-1', path: project }, second)

  assert.equal(
    store.readManagedWorkspaceRecovery('workspace-managed')?.checkoutRemovedAt,
    '2026-01-01T00:00:00.000Z',
  )
})

test('a managed Workspace whose checkout returns needs no recovery', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const store = memoryStore()
  const managedPath = path.join(path.dirname(project), 'managed')
  await run('git', ['-C', project, 'worktree', 'add', '-b', 'argo/workspace-managed', managedPath])
  store.writeWorkspace({
    id: 'workspace-managed',
    projectId: 'project-1',
    kind: 'managed',
    displayName: 'argo/workspace-managed',
    path: managedPath,
    baseRef: 'main',
  })

  await reconcileWorkspaces(store, { id: 'project-1', path: project })

  assert.equal(store.readManagedWorkspaceRecovery('workspace-managed'), null)
  await rm(managedPath, { recursive: true, force: true })
})
