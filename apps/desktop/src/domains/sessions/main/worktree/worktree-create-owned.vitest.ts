import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'
import { registeredRepoFixture } from '@/mocks/projects/registered-repo.fixture'
import { createOwnedWorktree } from './worktree-create-owned'

const run = promisify(execFile)

async function draftInput() {
  const { database, worktreeRoot } = await registeredRepoFixture()
  return { database, projectId: 'project-1', draftId: 'draft-one', worktreeRoot }
}

test('creates one worktree on its own branch and reuses it when the draft is sent again', async () => {
  const input = await draftInput()
  const first = await createOwnedWorktree(input)
  const second = await createOwnedWorktree(input)
  expect(second).toEqual(first)
  expect(first.branch).toMatch(/^argo\/session-/)
  expect(
    (await run('git', ['-C', first.path, 'rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim(),
  ).toBe(first.branch)
})

test('refuses to reuse a worktree folder that has moved to another branch', async () => {
  const input = await draftInput()
  const created = await createOwnedWorktree(input)
  await run('git', ['-C', created.path, 'checkout', '--quiet', '-b', 'moved-on'])
  await expect(createOwnedWorktree(input)).rejects.toThrow('worktree-path-conflict')
})
