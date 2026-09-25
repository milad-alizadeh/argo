import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { projectConfigurationSource } from '../../../../test-fixtures/projects/project-configuration.fixture'
import { openProject } from './open-project'
import type { ProjectStore } from './register-project'

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'argo-open-project-'))
  context.after(() => rm(project, { recursive: true, force: true }))
  const store: ProjectStore = {
    projects: {
      read: () => ({
        projects: [{ id: 'project-1', path: project, commonDirectory: path.join(project, '.git') }],
      }),
      replace: () => undefined,
      updateProjectPath: () => undefined,
      readSetupCheckpoint: () => null,
      writeSetupCheckpoint: () => {
        throw new Error('onboarding is disabled')
      },
      close: () => undefined,
    },
    chooseFolder: async () => null,
    exclusive: async (work) => work(),
  }
  return { project, name: path.basename(project), store }
}

test('opens an unconfigured Project without onboarding', async (context) => {
  const { name, store } = await fixture(context)

  assert.deepEqual(
    await openProject(
      { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' },
      store,
    ),
    {
      version: 1,
      type: 'project.opened',
      requestId: 'open-1',
      project: { id: 'project-1', name },
    },
  )
})

test('opens a Project after its shared configuration is valid', async (context) => {
  const { project, store } = await fixture(context)
  await mkdir(path.join(project, '.argo'))
  await writeFile(path.join(project, '.argo', 'settings.json'), projectConfigurationSource())

  assert.equal(
    (
      await openProject(
        { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' },
        store,
      )
    ).type,
    'project.opened',
  )
})
