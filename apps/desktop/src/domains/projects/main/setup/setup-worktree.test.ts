import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { setupWorktreeFixture } from '../../../../../test-fixtures/projects/setup/setup-worktree.fixture'
import { prepareSetupWorktree } from './setup-worktree'

const run = promisify(execFile)

test('creates one Project-owned setup worktree from the remote default branch', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const worktree = await prepareSetupWorktree({ id: 'project-1', path: project })
  const remoteHead = await run('git', ['-C', project, 'rev-parse', 'origin/main'])
  const setupHead = await run('git', ['-C', worktree, 'rev-parse', 'HEAD'])

  assert.equal(worktree, path.join(project, '.argo', 'worktrees', 'setup-project-1'))
  assert.equal(setupHead.stdout.trim(), remoteHead.stdout.trim())
})

test('returns the durable worktree when setup resumes', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const first = await prepareSetupWorktree({ id: 'project-1', path: project })

  assert.equal(await prepareSetupWorktree({ id: 'project-1', path: project }), first)
})
