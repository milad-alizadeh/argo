import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { saveManualProjectConfiguration } from '@/domains/projects/main/setup/manual-configuration'
import {
  beginManualSetup,
  MANUAL_CONFIGURATION_TEMPLATE,
  saveManualSetup,
} from '@/domains/projects/main/setup/manual-setup'
import type { SetupCheckpoint } from '@/domains/projects/main/sqlite-store'
import { setupWorktreeFixture } from '../../../../../test-fixtures/projects/setup/setup-worktree.fixture'

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

function registryFor(project: string) {
  let stored: SetupCheckpoint | null = null
  return {
    projects: {
      read: () => ({ projects: [{ id: 'project-1', path: project }], selectedId: 'project-1' }),
      readSetupCheckpoint: () => stored,
      updateProjectPath: () => {},
      writeSetupCheckpoint: (next: SetupCheckpoint) => {
        stored = next
      },
    },
  } as unknown as Parameters<typeof beginManualSetup>[1]
}

test('opens the starter configuration as unsaved', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const reply = await beginManualSetup(
    { projectId: 'project-1', requestId: 'r1' },
    registryFor(project),
  )

  assert.equal(reply.type === 'project.setup.editing' && reply.saved, false)
})

test('opens a saved configuration as saved', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const store = registryFor(project)
  await saveManualSetup({ projectId: 'project-1', requestId: 'r1', source }, store)
  const reply = await beginManualSetup({ projectId: 'project-1', requestId: 'r2' }, store)

  assert.equal(reply.type === 'project.setup.editing' && reply.saved, true)
})

test('tells the reader that every target needs its four commands', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const reply = await saveManualSetup(
    { projectId: 'project-1', requestId: 'r1', source: MANUAL_CONFIGURATION_TEMPLATE },
    registryFor(project),
  )

  assert.equal(reply.type, 'project.error')
  assert.match(reply.type === 'project.error' ? reply.message : '', /setup, run, build and test/)
})
