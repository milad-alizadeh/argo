import { execFile } from 'node:child_process'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { initTRPC } from '@trpc/server'
import { expect, onTestFinished, test } from 'vitest'
import { project } from '@/database/project/schema'
import { sessionTable } from '@/database/session/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { addLinkedWorktree, worktreeRepoFixture } from '@/mocks/projects/worktree-repo.fixture'
import { worktreeChooseProcedure, worktreeListProcedure } from './worktree-choices'

const run = promisify(execFile)

async function choices() {
  const { project: repository } = await worktreeRepoFixture({
    after: (cleanup) => onTestFinished(cleanup),
  })
  const database = migratedDatabase()
  onTestFinished(() => database.$client.close())
  database
    .insert(project)
    .values({ id: 'project-1', path: repository, commonDirectory: path.join(repository, '.git') })
    .run()
  const context = { database, exclusive: async <T>(work: () => Promise<T>) => work() }
  const caller = initTRPC
    .create()
    .router({ list: worktreeListProcedure(context), choose: worktreeChooseProcedure(context) })
    .createCaller({})
  const listed = async () => {
    const result = await caller.list({ projectId: 'project-1' })
    if (result.type !== 'worktree.listed') throw new Error(result.code)
    return result
  }
  return { repository, database, caller, listed }
}

test('offers the main checkout and each linked worktree, starting on a new worktree', async () => {
  const { repository, listed } = await choices()
  const linked = await addLinkedWorktree(repository)
  const result = await listed()
  expect(result.choice).toBe('new')
  expect(result.worktrees).toEqual([
    { path: repository, main: true, name: 'project', branch: 'main' },
    { path: linked, main: false, name: 'linked', branch: 'feature' },
  ])
})

test('remembers the main checkout or a linked worktree, and refuses a folder that is neither', async () => {
  const { repository, caller, listed } = await choices()
  const linked = await addLinkedWorktree(repository)
  await caller.choose({ projectId: 'project-1', choice: 'main' })
  expect((await listed()).choice).toBe('main')
  await caller.choose({ projectId: 'project-1', choice: linked })
  expect((await listed()).choice).toBe(linked)
  await expect(
    caller.choose({ projectId: 'project-1', choice: path.dirname(repository) }),
  ).rejects.toThrow('missing-worktree')
})

test('never offers a worktree another Session owns', async () => {
  const { repository, database, listed } = await choices()
  const linked = await addLinkedWorktree(repository)
  database
    .insert(sessionTable)
    .values({
      argoId: 'session-1',
      harness: 'codex',
      nativeId: 'native-1',
      projectId: 'project-1',
      worktreePath: linked,
      worktreeBranch: 'feature',
      worktreeOwned: true,
    })
    .run()
  expect((await listed()).worktrees.map((worktree) => worktree.path)).toEqual([repository])
})

test('a linked worktree deleted from disk leaves the list, pruned or not, and so does its choice', async () => {
  const { repository, caller, listed } = await choices()
  const pruned = await addLinkedWorktree(repository)
  await run('git', ['-C', repository, 'worktree', 'remove', '--force', pruned])
  expect((await listed()).worktrees).toHaveLength(1)
  const unpruned = await addLinkedWorktree(repository, 'second')
  await caller.choose({ projectId: 'project-1', choice: unpruned })
  await rm(unpruned, { recursive: true, force: true })
  const result = await listed()
  expect(result.worktrees).toHaveLength(1)
  expect(result.choice).toBe('new')
})
