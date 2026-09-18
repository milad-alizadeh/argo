import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { setupWorktreeFixture } from '../../../../../test-fixtures/projects/setup/setup-worktree.fixture'
import type { SetupCheckpoint } from '../sqlite-store'
import { saveManualProjectConfiguration } from './manual-configuration'

const run = promisify(execFile)

const source = JSON.stringify({
  version: 1,
  targets: {
    app: {
      default: true,
      path: '.',
      setup: 'bun install',
      run: 'bun run dev',
      build: 'bun run build',
      test: 'bun test',
    },
  },
})

test('writes manual configuration in the setup worktree, not the current checkout', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  let stored: SetupCheckpoint | null = null
  const checkpoint = await saveManualProjectConfiguration(
    { id: 'project-1', path: project },
    source,
    {
      readSetupCheckpoint: () => stored,
      writeSetupCheckpoint: (next) => {
        stored = next
      },
    },
  )

  assert.equal(checkpoint.phase, 'editing')
  assert.equal(
    await readFile(path.join(checkpoint.worktreePath, '.argo', 'settings.json'), 'utf8'),
    source,
  )
  assert.equal(
    await readFile(path.join(project, '.argo', 'settings.json'), 'utf8').catch(() => null),
    null,
  )
  const ignored = await run('git', [
    '-C',
    checkpoint.worktreePath,
    'check-ignore',
    '.argo/settings.local.json',
  ])
  assert.equal(ignored.stdout.trim(), '.argo/settings.local.json')
  assert.deepEqual(stored, checkpoint)
})
