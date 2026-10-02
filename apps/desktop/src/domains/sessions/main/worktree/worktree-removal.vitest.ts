// Argo follows Claude Code's cleanup rule: https://code.claude.com/docs/en/worktrees
import { execFile } from 'node:child_process'
import { stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { sessionTable } from '@/database/session/schema'
import { registeredRepoFixture } from '@/mocks/projects/registered-repo.fixture'
import { addLinkedWorktree } from '@/mocks/projects/worktree-repo.fixture'
import { createWorktree } from './worktree-create'
import { removeSessionWorktrees, worktreesWithWork } from './worktree-removal'

const run = promisify(execFile)
const commitAs = ['-c', 'user.email=argo@example.test', '-c', 'user.name=Argo']

// One Session in a fresh worktree of a real repository.
async function worktreeSession() {
  const { repository, database, worktreeRoot } = await registeredRepoFixture()
  const worktree = await createWorktree({
    database,
    projectId: 'project-1',
    draftId: 'draft-1',
    from: null,
    worktreeRoot,
  })
  database
    .insert(sessionTable)
    .values({
      argoId: 'session-1',
      harness: 'codex',
      nativeId: 'native-1',
      projectId: 'project-1',
      cwd: worktree.path,
      worktreePath: worktree.path,
      worktreeBranch: worktree.branch,
    })
    .run()
  const remove = (removal: 'clean' | 'all', running = false) =>
    removeSessionWorktrees(
      { database, isRunning: () => running },
      { sessionIds: ['session-1'], removal },
    )
  // The worktree and its branch are both gone.
  const expectGone = async () => {
    expect(await present(worktree.path)).toBe(false)
    expect(await branchExists(repository, worktree.branch)).toBe(false)
  }
  return { repository, database, worktree, remove, expectGone }
}

const present = (folder: string) =>
  stat(folder).then(
    () => true,
    () => false,
  )

async function branchExists(repository: string, branch: string): Promise<boolean> {
  return run('git', [
    '-C',
    repository,
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`,
  ]).then(
    () => true,
    () => false,
  )
}

test('a clean worktree goes on archive, with its branch', async () => {
  const { database, remove, expectGone } = await worktreeSession()
  expect(await worktreesWithWork(database, ['session-1'])).toEqual([])
  expect(await remove('clean')).toMatchObject([{ sessionId: 'session-1', outcome: 'removed' }])
  await expectGone()
})

test('a worktree with changed files is kept unless the person chose Remove', async () => {
  const { database, worktree, remove, expectGone } = await worktreeSession()
  await writeFile(path.join(worktree.path, 'notes.md'), 'unsaved thought\n')
  expect(await worktreesWithWork(database, ['session-1'])).toMatchObject([
    { sessionId: 'session-1', work: { changedFiles: 1, ownCommits: 0 } },
  ])
  expect(await remove('clean')).toMatchObject([{ sessionId: 'session-1', outcome: 'kept' }])
  expect(await present(worktree.path)).toBe(true)
  expect(await remove('all')).toMatchObject([{ sessionId: 'session-1', outcome: 'removed' }])
  await expectGone()
})

test('a worktree with commits on no other branch is kept unless the person chose Remove', async () => {
  const { database, worktree, remove } = await worktreeSession()
  await run('git', [
    '-C',
    worktree.path,
    ...commitAs,
    'commit',
    '--quiet',
    '--allow-empty',
    '-m',
    'work',
  ])
  expect(await worktreesWithWork(database, ['session-1'])).toMatchObject([
    { work: { changedFiles: 0, ownCommits: 1 } },
  ])
  expect(await remove('clean')).toMatchObject([{ sessionId: 'session-1', outcome: 'kept' }])
  expect(await present(worktree.path)).toBe(true)
})

test('a worktree git cannot read is kept and reported as unchecked', async () => {
  const { database, worktree, remove } = await worktreeSession()
  await writeFile(path.join(worktree.path, '.git'), 'not a gitdir\n')
  expect(await worktreesWithWork(database, ['session-1'])).toMatchObject([
    { work: { changedFiles: null, ownCommits: null } },
  ])
  expect(await remove('clean')).toMatchObject([{ sessionId: 'session-1', outcome: 'kept' }])
  expect(await present(worktree.path)).toBe(true)
})

test('a worktree stays while its Session has a Turn in progress, even after Remove', async () => {
  const { worktree, remove } = await worktreeSession()
  expect(await remove('all', true)).toMatchObject([{ sessionId: 'session-1', outcome: 'running' }])
  expect(await present(worktree.path)).toBe(true)
})

// A worktree made outside Argo follows the same rule as one Argo made.
test('a clean worktree made outside Argo goes on archive too, with its branch', async () => {
  const { repository, database } = await worktreeSession()
  const outside = await addLinkedWorktree(repository, 'outside')
  database
    .insert(sessionTable)
    .values({
      argoId: 'session-outside',
      harness: 'claude',
      nativeId: 'native-outside',
      projectId: 'project-1',
      cwd: outside,
      worktreePath: outside,
      worktreeBranch: 'outside',
    })
    .run()
  expect(
    await removeSessionWorktrees(
      { database, isRunning: () => false },
      { sessionIds: ['session-outside'], removal: 'clean' },
    ),
  ).toMatchObject([{ sessionId: 'session-outside', outcome: 'removed' }])
  expect(await present(outside)).toBe(false)
  expect(await branchExists(repository, 'outside')).toBe(false)
})

test('a worktree another unarchived Session runs in stays', async () => {
  const { database, worktree, remove } = await worktreeSession()
  database
    .insert(sessionTable)
    .values({
      argoId: 'session-2',
      harness: 'claude',
      nativeId: 'native-2',
      projectId: 'project-1',
      cwd: worktree.path,
      worktreePath: worktree.path,
      worktreeBranch: worktree.branch,
    })
    .run()
  expect(await remove('all')).toEqual([])
  expect(await present(worktree.path)).toBe(true)
})

test('the main checkout is never removed', async () => {
  const { repository, database } = await worktreeSession()
  database
    .insert(sessionTable)
    .values({
      argoId: 'session-main',
      harness: 'codex',
      nativeId: 'native-main',
      projectId: 'project-1',
      cwd: repository,
    })
    .run()
  expect(await worktreesWithWork(database, ['session-main'])).toEqual([])
  expect(
    await removeSessionWorktrees(
      { database, isRunning: () => false },
      { sessionIds: ['session-main'], removal: 'all' },
    ),
  ).toEqual([])
  expect(await present(repository)).toBe(true)
})
