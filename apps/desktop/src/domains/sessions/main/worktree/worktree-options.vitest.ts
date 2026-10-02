import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { initTRPC } from '@trpc/server'
import { expect, test } from 'vitest'
import { registeredRepoFixture } from '@/mocks/projects/registered-repo.fixture'
import {
  worktreeOptionsProcedure,
  worktreePullRequestsProcedure,
  worktreeSwitchProcedure,
} from './worktree-options'
import type { PullRequestListing } from './worktree-pull-requests'

const run = promisify(execFile)

async function options(listing: PullRequestListing = { type: 'listed', pullRequests: [] }) {
  const { repository, database } = await registeredRepoFixture()
  const asked: { id: string; checkout: string }[] = []
  const context = {
    database,
    exclusive: async <T>(work: () => Promise<T>) => work(),
    listPullRequests: async (project: { id: string; checkout: string }) => {
      asked.push(project)
      return listing
    },
  }
  const caller = initTRPC
    .create()
    .router({
      options: worktreeOptionsProcedure(context),
      switch: worktreeSwitchProcedure(context),
      pullRequests: worktreePullRequestsProcedure(context),
    })
    .createCaller({})
  const read = async () => {
    const result = await caller.options({ projectId: 'project-1' })
    if (result.type !== 'worktree.options') throw new Error(result.code)
    return result
  }
  return { repository, caller, read, asked }
}

test('a new Project starts with the switch off, on its main checkout and current branch', async () => {
  const { repository, read } = await options()
  expect(await read()).toMatchObject({
    newWorktree: false,
    checkout: { path: repository, branch: 'main' },
    branches: ['main'],
  })
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

test('asks for pull requests from the main checkout, and passes on why there are none', async () => {
  const { repository, caller, asked } = await options({ type: 'unavailable', reason: 'no-remote' })
  expect(await caller.pullRequests({ projectId: 'project-1' })).toEqual({
    type: 'unavailable',
    reason: 'no-remote',
  })
  expect(asked).toEqual([{ id: 'project-1', checkout: repository }])
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
