import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { openProject } from '@/domains/projects/main/open-project'
import { readProjectConfigurationSource } from '@/domains/projects/main/project-configuration'
import type { ProjectStore } from '@/domains/projects/main/register-project'
import type { SetupCheckpoint } from '@/domains/projects/main/sqlite-store'
import { projectConfigurationSource } from '../../../../test-fixtures/projects/project-configuration.fixture'
import {
  SETUP_DOCUMENT_REVISION,
  setupDocumentFixture,
} from '../../../../test-fixtures/projects/setup-document.fixture'
import { parseSetupDocument, type SetupDocument } from '../contract/setup-document'

async function fixture(context: { after: (callback: () => Promise<void>) => void }) {
  const project = await mkdtemp(path.join(os.tmpdir(), 'argo-open-project-'))
  context.after(() => rm(project, { recursive: true, force: true }))
  let checkpoint: SetupCheckpoint | null = null
  let document: SetupDocument = parseSetupDocument(setupDocumentFixture())
  const store: ProjectStore & { loadSetupDocument: () => Promise<SetupDocument> } = {
    projects: {
      read: () => ({
        projects: [{ id: 'project-1', path: project, commonDirectory: path.join(project, '.git') }],
        selectedId: 'project-1',
      }),
      replace: () => undefined,
      updateProjectPath: () => undefined,
      readSetupCheckpoint: () => checkpoint,
      writeSetupCheckpoint: (next) => {
        checkpoint = next
      },
      close: () => undefined,
    },
    chooseFolder: async () => null,
    exclusive: async (work) => work(),
    loadSetupDocument: async () => document,
  }
  return {
    project,
    name: path.basename(project),
    store,
    writeCheckpoint: (next: SetupCheckpoint) => {
      checkpoint = next
    },
    checkpoint: () => checkpoint,
    setDocument: (next: SetupDocument) => {
      document = next
    },
  }
}

test('routes an unconfigured Project to required setup', async (context) => {
  const { name, store } = await fixture(context)

  assert.deepEqual(
    await openProject(
      { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' },
      store,
    ),
    {
      version: 1,
      type: 'project.setup-required',
      requestId: 'open-1',
      project: { id: 'project-1', name },
    },
  )
})

test('returns to setup when an ignored local override changes after validation', async (context) => {
  const { project, store, writeCheckpoint, checkpoint } = await fixture(context)
  await mkdir(path.join(project, '.argo'))
  await writeFile(
    path.join(project, '.argo', 'settings.json'),
    projectConfigurationSource({ setup: 'true', run: 'true', build: 'true', test: 'true' }),
  )
  writeCheckpoint({
    projectId: 'project-1',
    worktreePath: project,
    phase: 'ready',
    configurationSource: (await readProjectConfigurationSource(project)) ?? '',
    documentRevision: SETUP_DOCUMENT_REVISION,
  })
  await writeFile(
    path.join(project, '.argo', 'settings.local.json'),
    JSON.stringify({ targets: { app: { path: 'app' } } }),
  )

  assert.equal(
    (
      await openProject(
        { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' },
        store,
      )
    ).type,
    'project.setup-required',
  )
  assert.equal(checkpoint()?.phase, 'editing')
})

test('returns a ready Project to setup when the GitHub document revision changes', async (context) => {
  const { checkpoint, project, setDocument, store, writeCheckpoint } = await fixture(context)
  const source = projectConfigurationSource()
  await mkdir(path.join(project, '.argo'))
  await writeFile(path.join(project, '.argo', 'settings.json'), source)
  writeCheckpoint({
    projectId: 'project-1',
    worktreePath: project,
    phase: 'ready',
    configurationSource: source,
    documentRevision: SETUP_DOCUMENT_REVISION,
  })
  setDocument(parseSetupDocument(setupDocumentFixture({ revision: '2026-09-19.1' })))

  assert.equal(
    (
      await openProject(
        { version: 1, type: 'project.open', requestId: 'open-1', projectId: 'project-1' },
        store,
      )
    ).type,
    'project.setup-required',
  )
  assert.equal(checkpoint()?.phase, 'editing')
  assert.equal(checkpoint()?.documentRevision, SETUP_DOCUMENT_REVISION)
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
