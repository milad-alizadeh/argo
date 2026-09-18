import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { saveManualProjectConfiguration } from './manual-configuration'
import { setupWorktreeFixture } from './setup-worktree-fixture'
import type { SetupCheckpoint } from './sqlite-store'

const run = promisify(execFile)

const source = [
  'version = 1',
  '',
  '[targets.app]',
  'default = true',
  'path = "."',
  'setup = "bun install"',
  'run = "bun run dev"',
  'build = "bun run build"',
  'test = "bun test"',
  '',
].join('\n')

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
    await readFile(path.join(checkpoint.worktreePath, '.argo', 'settings.toml'), 'utf8'),
    source,
  )
  assert.equal(
    await readFile(path.join(project, '.argo', 'settings.toml'), 'utf8').catch(() => null),
    null,
  )
  const ignored = await run('git', [
    '-C',
    checkpoint.worktreePath,
    'check-ignore',
    '.argo/settings.local.toml',
  ])
  assert.equal(ignored.stdout.trim(), '.argo/settings.local.toml')
  assert.deepEqual(stored, checkpoint)
})
