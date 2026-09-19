import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectConfigurationSource } from '../../../../../test-fixtures/projects/project-configuration.fixture'
import { setupStoreFixture } from '../../../../../test-fixtures/projects/setup/setup-store.fixture'
import { setupWorktreeFixture } from '../../../../../test-fixtures/projects/setup/setup-worktree.fixture'
import { setupDocumentFixture } from '../../../../../test-fixtures/projects/setup-document.fixture'
import { parseSetupDocument } from '../../contract/setup-document'
import { beginManualSetup, saveManualSetup } from './manual-setup'

const document = parseSetupDocument(setupDocumentFixture())

test('opens generated setup configuration as unsaved', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const setup = setupStoreFixture(project, document)
  const reply = await beginManualSetup(
    { projectId: 'project-1', requestId: 'setup-begin' },
    setup.store,
  )

  assert.equal(reply.type, 'project.setup.editing')
  assert.equal(reply.type === 'project.setup.editing' && reply.saved, false)
})

test('returns the exact saved configuration as saved', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const setup = setupStoreFixture(project, document)
  const source = `${projectConfigurationSource()}\n`
  const reply = await saveManualSetup(
    { projectId: 'project-1', requestId: 'setup-save', source },
    setup.store,
  )

  assert.equal(reply.type, 'project.setup.editing')
  if (reply.type !== 'project.setup.editing') return
  assert.equal(reply.saved, true)
  assert.equal(reply.source, source)
})

test('opens stored setup configuration as saved', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const setup = setupStoreFixture(project, document)
  const source = projectConfigurationSource()
  await saveManualSetup({ projectId: 'project-1', requestId: 'setup-save', source }, setup.store)
  const reply = await beginManualSetup(
    { projectId: 'project-1', requestId: 'setup-begin' },
    setup.store,
  )

  assert.equal(reply.type, 'project.setup.editing')
  assert.equal(reply.type === 'project.setup.editing' && reply.saved, true)
})

test('explains the four commands required by every target', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const setup = setupStoreFixture(project, document)
  const reply = await saveManualSetup(
    {
      projectId: 'project-1',
      requestId: 'setup-save',
      source: projectConfigurationSource({ setup: '' }),
    },
    setup.store,
  )

  assert.equal(reply.type, 'project.error')
  assert.match(reply.type === 'project.error' ? reply.message : '', /setup, run, build and test/)
})
