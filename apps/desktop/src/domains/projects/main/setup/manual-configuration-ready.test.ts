import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { projectConfigurationSource } from '../../../../../test-fixtures/projects/project-configuration.fixture'
import { readProjectConfigurationSource } from '../project-configuration'
import type { SetupCheckpoint } from '../sqlite-store'
import { saveManualProjectConfiguration } from './manual-configuration'

const source = projectConfigurationSource()

test('keeps a tested configuration ready after importing it', async (context) => {
  const worktreePath = await mkdtemp(path.join(os.tmpdir(), 'argo-ready-setup-'))
  context.after(async () => rm(worktreePath, { force: true, recursive: true }))
  let stored: SetupCheckpoint | null = {
    projectId: 'project-1',
    worktreePath,
    phase: 'ready',
    configurationSource: source,
    documentRevision: 'revision-1',
  }

  const checkpoint = await saveManualProjectConfiguration({
    documentRevision: 'revision-1',
    project: { id: 'project-1', path: '/unused' },
    source,
    store: {
      readSetupCheckpoint: () => stored,
      writeSetupCheckpoint: (next) => {
        stored = next
      },
    },
  })

  assert.equal(checkpoint.phase, 'ready')
  assert.equal(checkpoint.configurationSource, await readProjectConfigurationSource(worktreePath))
  assert.deepEqual(stored, checkpoint)
})
