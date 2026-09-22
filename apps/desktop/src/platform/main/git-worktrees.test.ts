import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import {
  gitCommonDirectory,
  linkedWorktreePaths,
  mainWorktreePath,
} from '@/platform/main/git-worktrees'
import {
  addLinkedWorktree,
  workspaceRepoFixture,
} from '../../../test-fixtures/projects/workspaces/workspace-repo.fixture'

test('reads the main worktree back from its own common directory', async (context) => {
  const { project } = await workspaceRepoFixture(context)

  const common = await gitCommonDirectory(project)

  assert.equal(common, path.join(project, '.git'))
  assert.equal(mainWorktreePath(common), project)
})

test('lists a linked worktree by its real path, not by name', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const linked = await addLinkedWorktree(project)

  const common = await gitCommonDirectory(project)
  const roots = await linkedWorktreePaths(common)

  assert.deepEqual(roots, [linked])
})

test('reports no linked worktrees for a checkout that has none', async (context) => {
  const { project } = await workspaceRepoFixture(context)

  const common = await gitCommonDirectory(project)

  assert.deepEqual(await linkedWorktreePaths(common), [])
})

test('reads a linked worktree own common directory as the main checkout own', async (context) => {
  const { project } = await workspaceRepoFixture(context)
  const linked = await addLinkedWorktree(project)

  const common = await gitCommonDirectory(linked)

  assert.equal(common, path.join(project, '.git'))
  assert.equal(mainWorktreePath(common), project)
})
