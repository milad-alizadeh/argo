// Argo follows Claude Code's cleanup rule: https://code.claude.com/docs/en/worktrees
import { execFile } from 'node:child_process'
import { stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, onTestFinished, test } from 'vitest'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { addLinkedWorktree, worktreeRepoFixture } from '@/mocks/projects/worktree-repo.fixture'
import { createOwnedWorktree } from './worktree-create-owned'
import { removeOwnedWorktrees, worktreesWithWork } from './worktree-removal'

const run = promisify(execFile)
const commitAs = ['-c', 'user.email=argo@example.test', '-c', 'user.name=Argo']

// One Session that owns a fresh worktree of a real repository.
async function ownedSession() {
  const { project: repository } = await worktreeRepoFixture({
    after: (cleanup) => onTestFinished(cleanup),
  })
  const database = migratedDatabase()
  onTestFinished(() => database.$client.close())
  database
    .insert(project)
    .values({ id: 'project-1', path: repository, commonDirectory: path.join(repository, '.git') })
    .run()
  const worktree = await createOwnedWorktree({
    database,
    projectId: 'project-1',
    draftId: 'draft-1',
    worktreeRoot: path.join(path.dirname(repository), 'worktrees'),
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
      worktreeOwned: true,
    })
    .run()
  const remove = (removal: 'clean' | 'all', running = false) =>
    removeOwnedWorktrees(
      { database, isRunning: () => running },
      { sessionIds: ['session-1'], removal },
    )
  return { repository, database, worktree, remove }
}

const present = (folder: string) =>
  stat(folder).then(
    () => true,
    () => false,
  )

async function branchExists(repository: string, branch: string): Promise<boolean> {
  return run('git', ['-C', repository, 'show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).then(
    () => true,
    () => false,
  )
}

test('a clean worktree goes on archive, with its branch', async () => {
  const { repository, database, worktree, remove } = await ownedSession()
  expect(await worktreesWithWork(database, ['session-1'])).toEqual([])
  expect(await remove('clean')).toEqual([{ sessionId: 'session-1', outcome: 'removed' }])
  expect(await present(worktree.path)).toBe(false)
  expect(await branchExists(repository, worktree.branch)).toBe(false)
})

test('a worktree with changed files is kept unless the person chose Remove', async () => {
  const { repository, database, worktree, remove } = await ownedSession()
  await writeFile(path.join(worktree.path, 'notes.md'), 'unsaved thought\n')
  expect(await worktreesWithWork(database, ['session-1'])).toMatchObject([
    { sessionId: 'session-1', work: { changedFiles: 1, ownCommits: 0 } },
  ])
  expect(await remove('clean')).toEqual([{ sessionId: 'session-1', outcome: 'kept' }])
  expect(await present(worktree.path)).toBe(true)
  expect(await remove('all')).toEqual([{ sessionId: 'session-1', outcome: 'removed' }])
  expect(await present(worktree.path)).toBe(false)
  expect(await branchExists(repository, worktree.branch)).toBe(false)
})

test('a worktree with commits on no other branch is kept unless the person chose Remove', async () => {
  const { database, worktree, remove } = await ownedSession()
  await run('git', ['-C', worktree.path, ...commitAs, 'commit', '--quiet', '--allow-empty', '-m', 'work'])
  expect(await worktreesWithWork(database, ['session-1'])).toMatchObject([
    { work: { changedFiles: 0, ownCommits: 1 } },
  ])
  expect(await remove('clean')).toEqual([{ sessionId: 'session-1', outcome: 'kept' }])
  expect(await present(worktree.path)).toBe(true)
})

test('a worktree git cannot read is kept and reported as unchecked', async () => {
  const { database, worktree, remove } = await ownedSession()
  await writeFile(path.join(worktree.path, '.git'), 'not a gitdir\n')
  expect(await worktreesWithWork(database, ['session-1'])).toMatchObject([
    { work: { changedFiles: null, ownCommits: null } },
  ])
  expect(await remove('clean')).toEqual([{ sessionId: 'session-1', outcome: 'kept' }])
  expect(await present(worktree.path)).toBe(true)
})

test('a worktree stays while its Session has a Turn in progress, even after Remove', async () => {
  const { worktree, remove } = await ownedSession()
  expect(await remove('all', true)).toEqual([{ sessionId: 'session-1', outcome: 'running' }])
  expect(await present(worktree.path)).toBe(true)
})

test('an imported worktree and the main checkout are never removed', async () => {
  const { repository, database } = await ownedSession()
  const imported = await addLinkedWorktree(repository)
  database
    .insert(sessionTable)
    .values([
      {
        argoId: 'session-imported',
        harness: 'claude',
        nativeId: 'native-imported',
        projectId: 'project-1',
        cwd: imported,
        worktreePath: imported,
        worktreeBranch: 'feature',
        worktreeOwned: false,
      },
      {
        argoId: 'session-main',
        harness: 'codex',
        nativeId: 'native-main',
        projectId: 'project-1',
        cwd: repository,
      },
    ])
    .run()
  const sessionIds = ['session-imported', 'session-main']
  expect(await worktreesWithWork(database, sessionIds)).toEqual([])
  expect(
    await removeOwnedWorktrees({ database, isRunning: () => false }, { sessionIds, removal: 'all' }),
  ).toEqual([])
  expect(await present(imported)).toBe(true)
  expect(await present(repository)).toBe(true)
})
