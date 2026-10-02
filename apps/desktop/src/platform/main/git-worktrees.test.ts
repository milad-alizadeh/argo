import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { addLinkedWorktree, worktreeRepoFixture } from '@/mocks/projects/worktree-repo.fixture'
import {
  gitCommonDirectory,
  linkedWorktrees,
  mainWorktreePath,
  remoteDefaultBranch,
} from './git-worktrees'

const run = promisify(execFile)

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

test('reads the default branch from origin/HEAD, even after its refs are packed', async (context) => {
  const { project } = await worktreeRepoFixture(context)
  const clone = path.join(path.dirname(project), 'clone')
  await run('git', ['-C', project, 'branch', '--move', 'main', 'trunk'])
  await run('git', ['clone', '--quiet', project, clone])
  await run('git', ['-C', clone, 'pack-refs', '--all'])

  assert.equal(await remoteDefaultBranch(await gitCommonDirectory(clone)), 'trunk')
})

test('has no default branch without an origin HEAD', async (context) => {
  const { project } = await worktreeRepoFixture(context)

  assert.equal(await remoteDefaultBranch(await gitCommonDirectory(project)), null)
})
