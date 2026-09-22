import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { workspaceRepoFixture } from '../../../../../test-fixtures/projects/workspaces/workspace-repo.fixture'
import { createManagedWorkspace } from './create-managed-workspace'
import type { WorkspaceRecord, WorkspaceStore } from './workspace-store'

const run = promisify(execFile)

function memoryStore(): WorkspaceStore {
  const workspaces = new Map<string, WorkspaceRecord>()
  const selections = new Map<string, string>()
  return {
    readWorkspaces: (projectId: string) =>
      [...workspaces.values()].filter((candidate) => candidate.projectId === projectId),
    writeWorkspace: (record: WorkspaceRecord) => workspaces.set(record.id, record),
    selectWorkspace: (projectId: string, workspaceId: string) =>
      selections.set(projectId, workspaceId),
    readWorkspaceSelection: (projectId: string) => selections.get(projectId) ?? null,
    writeManagedWorkspaceRecovery: () => undefined,
    readManagedWorkspaceRecovery: () => null,
  }
}

test('creates a managed worktree under .argo/worktrees and selects it', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const store = memoryStore()

  const record = await createManagedWorkspace(store, { id: 'project-1', path: project }, 'main')

  assert.equal(record.kind, 'managed')
  assert.equal(path.dirname(record.path), path.join(project, '.argo', 'worktrees'))
  assert.equal(store.readWorkspaceSelection('project-1'), record.id)
  const branch = await run('git', ['-C', record.path, 'branch', '--show-current'])
  assert.equal(branch.stdout.trim(), record.displayName)
})

test('each managed Workspace gets its own branch and directory', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const store = memoryStore()

  const first = await createManagedWorkspace(store, { id: 'project-1', path: project }, 'main')
  const second = await createManagedWorkspace(store, { id: 'project-1', path: project }, 'main')

  assert.notEqual(first.id, second.id)
  assert.notEqual(first.path, second.path)
  assert.equal(store.readWorkspaceSelection('project-1'), second.id)
})
