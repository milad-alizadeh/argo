import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'
import { setupStoreFixture } from '../../../../../test-fixtures/projects/setup/setup-store.fixture'
import { setupWorktreeFixture } from '../../../../../test-fixtures/projects/setup/setup-worktree.fixture'
import {
  SETUP_DOCUMENT_REVISION,
  setupDocumentFixture,
} from '../../../../../test-fixtures/projects/setup-document.fixture'
import { parseSetupDocument } from '../../contract/setup-document'
import type { SetupCheckpoint } from '../sqlite-store'
import { saveManualProjectConfiguration } from './manual-configuration'
import { beginManualSetup } from './manual-setup'
import { SetupDocumentLoadError } from './setup-bundle'

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

const setupDocument = parseSetupDocument(
  setupDocumentFixture({
    locales: {
      en: {
        title: 'Set up this Project',
        description: 'Review the plan.',
        fields: { 'target-path': { label: 'Working path' } },
        plan: {},
      },
    },
    fields: [
      {
        id: 'target-path',
        type: 'text',
        recommendation: 'apps/desktop',
        configurationPath: ['targets', 'app', 'path'],
      },
    ],
    configuration: { version: 1, targets: { app: { default: true, path: '.' } } },
    plan: [],
  }),
)

test('reports the GitHub Setup document failure', async () => {
  for (const [reason, code] of [
    ['network-unavailable', 'setup-network-unavailable'],
    ['document-invalid', 'setup-document-invalid'],
  ] as const) {
    const reply = await beginManualSetup(
      { projectId: 'project-1', requestId: `setup-${reason}` },
      {
        projects: {
          read: () => ({
            projects: [{ id: 'project-1', path: '/project', commonDirectory: '/project' }],
            selectedId: 'project-1',
          }),
          readSetupCheckpoint: () => null,
          updateProjectPath: () => undefined,
          writeSetupCheckpoint: () => undefined,
        },
        loadSetupDocument: async () => {
          throw new SetupDocumentLoadError(reason)
        },
      },
    )
    assert.equal(reply.type, 'project.error')
    if (reply.type === 'project.error') assert.equal(reply.code, code)
  }
})

test('starts Setup with the configuration from the GitHub document', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const setup = setupStoreFixture(project, setupDocument)
  const reply = await beginManualSetup(
    { projectId: 'project-1', requestId: 'setup-1' },
    setup.store,
  )

  assert.equal(reply.type, 'project.setup.editing')
  if (reply.type !== 'project.setup.editing') return
  assert.equal(reply.document.locales.en.title, 'Set up this Project')
  assert.equal(JSON.parse(reply.source).targets.app.path, 'apps/desktop')
  assert.equal(setup.checkpoint()?.configurationSource, reply.source)
})

test('writes manual configuration in the setup worktree, not the current checkout', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  let stored: SetupCheckpoint | null = null
  const checkpoint = await saveManualProjectConfiguration({
    documentRevision: SETUP_DOCUMENT_REVISION,
    project: { id: 'project-1', path: project },
    source,
    store: {
      readSetupCheckpoint: () => stored,
      writeSetupCheckpoint: (next) => {
        stored = next
      },
    },
  })

  assert.equal(checkpoint.phase, 'ready')
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
