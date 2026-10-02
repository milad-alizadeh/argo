import { execFile } from 'node:child_process'
import { access, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { registeredRepoFixture } from '@/mocks/projects/registered-repo.fixture'
import { createWorktree } from './worktree-create'

const run = promisify(execFile)
const IDENTITY = ['-c', 'user.email=argo@example.test', '-c', 'user.name=Argo']

async function draftInput(from: string | null = null) {
  const { database, repository, worktreeRoot } = await registeredRepoFixture()
  const input = {
    database,
    projectId: 'project-1',
    draftId: 'draft-one',
    from,
    worktreeRoot,
  }
  return { input, repository }
}

async function commit(folder: string, message: string): Promise<string> {
  await run('git', ['-C', folder, ...IDENTITY, 'commit', '--quiet', '--allow-empty', '-m', message])
  return head(folder)
}

async function head(folder: string): Promise<string> {
  return (await run('git', ['-C', folder, 'rev-parse', 'HEAD'])).stdout.trim()
}

test('creates one worktree on its own branch and reuses it when the draft is sent again', async () => {
  const { input } = await draftInput()
  const first = await createWorktree(input)
  const second = await createWorktree(input)
  expect(second).toEqual(first)
  expect(first.branch).toMatch(/^argo\/session-/)
  // With no branch chosen, it starts from the main checkout's current branch.
  expect(first.base).toBe('main')
  expect(
    (await run('git', ['-C', first.path, 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim(),
  ).toBe(first.branch)
})

test('refuses to reuse a worktree folder that has moved to another branch', async () => {
  const { input } = await draftInput()
  const created = await createWorktree(input)
  await run('git', ['-C', created.path, 'checkout', '--quiet', '-b', 'moved-on'])
  await expect(createWorktree(input)).rejects.toThrow('worktree-path-conflict')
})

test('starts at the main checkout commit and leaves its uncommitted changes behind', async () => {
  const { input, repository } = await draftInput()
  await writeFile(path.join(repository, 'draft.txt'), 'not committed')
  const created = await createWorktree(input)
  expect(await head(created.path)).toBe(await head(repository))
  await expect(access(path.join(created.path, 'draft.txt'))).rejects.toThrow()
})

test('starts at the chosen branch', async () => {
  const { input, repository } = await draftInput('base')
  await run('git', ['-C', repository, 'checkout', '--quiet', '-b', 'base'])
  const base = await commit(repository, 'on base')
  await run('git', ['-C', repository, 'checkout', '--quiet', 'main'])
  const created = await createWorktree(input)
  expect(await head(created.path)).toBe(base)
  expect(created.base).toBe('base')
})

test('refuses a branch that does not exist', async () => {
  const { input } = await draftInput('missing')
  await expect(createWorktree(input)).rejects.toThrow()
})
