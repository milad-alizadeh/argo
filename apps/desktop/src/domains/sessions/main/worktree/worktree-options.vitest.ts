import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { initTRPC } from '@trpc/server'
import { expect, test } from 'vitest'
import { registeredRepoFixture } from '@/mocks/projects/registered-repo.fixture'
import { worktreeOptionsProcedure, worktreeSwitchProcedure } from './worktree-options'

const run = promisify(execFile)

async function options() {
  const { repository, database } = await registeredRepoFixture()
  const context = { database, exclusive: async <T>(work: () => Promise<T>) => work() }
  const caller = initTRPC
    .create()
    .router({
      options: worktreeOptionsProcedure(context),
      switch: worktreeSwitchProcedure(context),
    })
    .createCaller({})
  const read = async () => {
    const result = await caller.options({ projectId: 'project-1' })
    if (result.type !== 'worktree.options') throw new Error(result.code)
    return result
  }
  return { repository, caller, read }
}

test('a new Project starts with the switch off, on its main checkout and current branch', async () => {
  const { repository, read } = await options()
  expect(await read()).toMatchObject({
    newWorktree: false,
    checkout: { path: repository, branch: 'main' },
    branches: ['main'],
    defaultBranch: 'main',
  })
})

test("the default branch is origin's HEAD, whatever the main checkout is on", async () => {
  const { repository, read } = await options()
  await run('git', ['-C', repository, 'branch', 'trunk'])
  await run('git', ['-C', repository, 'update-ref', 'refs/remotes/origin/trunk', 'trunk'])
  await run('git', [
    '-C',
    repository,
    'symbolic-ref',
    'refs/remotes/origin/HEAD',
    'refs/remotes/origin/trunk',
  ])
  await run('git', ['-C', repository, 'checkout', '--quiet', '-b', 'elsewhere'])
  expect(await read()).toMatchObject({ checkout: { branch: 'elsewhere' }, defaultBranch: 'trunk' })
})

test('lists every local branch, the most recently committed first', async () => {
  const { repository, read } = await options()
  const identity = ['-c', 'user.email=argo@example.test', '-c', 'user.name=Argo']
  await run('git', ['-C', repository, 'branch', 'older'])
  await run('git', ['-C', repository, 'checkout', '--quiet', '-b', 'newer'])
  await run(
    'git',
    ['-C', repository, ...identity, 'commit', '--quiet', '--allow-empty', '-m', 'newer'],
    {
      env: { ...process.env, GIT_COMMITTER_DATE: '2099-01-01T00:00:00' },
    },
  )
  const result = await read()
  expect(result.checkout.branch).toBe('newer')
  expect(result.branches[0]).toBe('newer')
  expect([...result.branches].sort()).toEqual(['main', 'newer', 'older'])
})

test('remembers the switch for the Project', async () => {
  const { caller, read } = await options()
  await caller.switch({ projectId: 'project-1', newWorktree: true })
  expect((await read()).newWorktree).toBe(true)
  await caller.switch({ projectId: 'project-1', newWorktree: false })
  expect((await read()).newWorktree).toBe(false)
})

test('a detached main checkout has no current branch', async () => {
  const { repository, read } = await options()
  await run('git', ['-C', repository, 'checkout', '--quiet', '--detach'])
  expect((await read()).checkout.branch).toBeNull()
})

test('an unknown Project has no options', async () => {
  const { caller } = await options()
  expect(await caller.options({ projectId: 'project-2' })).toMatchObject({
    type: 'worktree.error',
    code: 'missing-project',
  })
  await expect(caller.switch({ projectId: 'project-2', newWorktree: true })).rejects.toThrow(
    'missing-project',
  )
})
