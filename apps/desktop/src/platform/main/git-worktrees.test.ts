import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import { addLinkedWorktree, worktreeRepoFixture } from '@/mocks/projects/worktree-repo.fixture'
import { gitCommonDirectory, linkedWorktrees, mainWorktreePath } from './git-worktrees'

test('reads the main worktree back from its own common directory', async (context) => {
  const { project } = await worktreeRepoFixture(context)

  const common = await gitCommonDirectory(project)

  assert.equal(common, path.join(project, '.git'))
  assert.equal(mainWorktreePath(common), project)
})

test('lists a linked worktree by its real path and branch, not by name', async (context) => {
  const { project } = await worktreeRepoFixture(context)
  const linked = await addLinkedWorktree(project)

  const common = await gitCommonDirectory(project)
  const roots = await linkedWorktrees(common)

  assert.deepEqual(roots, [{ path: linked, branch: 'feature' }])
})

test('reports no linked worktrees for a checkout that has none', async (context) => {
  const { project } = await worktreeRepoFixture(context)

  const common = await gitCommonDirectory(project)

  assert.deepEqual(await linkedWorktrees(common), [])
})

test('reads a linked worktree own common directory as the main checkout own', async (context) => {
  const { project } = await worktreeRepoFixture(context)
  const linked = await addLinkedWorktree(project)

  const common = await gitCommonDirectory(linked)

  assert.equal(common, path.join(project, '.git'))
  assert.equal(mainWorktreePath(common), project)
})
