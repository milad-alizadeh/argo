import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, onTestFinished, test } from 'vitest'
import { project } from '@/database/project/schema'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { worktreeRepoFixture } from '@/mocks/projects/worktree-repo.fixture'
import { createOwnedWorktree } from './worktree-create-owned'

const run = promisify(execFile)

async function draftInput() {
  const { project: repository } = await worktreeRepoFixture({
    after: (cleanup) => onTestFinished(cleanup),
  })
  const database = migratedDatabase()
  onTestFinished(() => database.$client.close())
  database
    .insert(project)
    .values({ id: 'project-1', path: repository, commonDirectory: path.join(repository, '.git') })
    .run()
  return {
    database,
    projectId: 'project-1',
    draftId: 'draft-one',
    worktreeRoot: path.join(path.dirname(repository), 'worktrees'),
  }
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
