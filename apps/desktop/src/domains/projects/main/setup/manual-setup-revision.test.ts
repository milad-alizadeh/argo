import assert from 'node:assert/strict'
import { test } from 'node:test'
import { projectConfigurationSource } from '../../../../../test-fixtures/projects/project-configuration.fixture'
import { setupStoreFixture } from '../../../../../test-fixtures/projects/setup/setup-store.fixture'
import { setupWorktreeFixture } from '../../../../../test-fixtures/projects/setup/setup-worktree.fixture'
import {
  SETUP_DOCUMENT_REVISION,
  setupDocumentFixture,
} from '../../../../../test-fixtures/projects/setup-document.fixture'
import { parseSetupDocument } from '../../contract/setup-document'
import { saveManualSetup } from './manual-setup'

const source = projectConfigurationSource()

test('does not mark an unreviewed Setup document revision as ready', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const reviewed = {
    projectId: 'project-1',
    worktreePath: project,
    phase: 'ready' as const,
    configurationSource: source,
    documentRevision: SETUP_DOCUMENT_REVISION,
  }
  const newerDocument = parseSetupDocument(
    setupDocumentFixture({ revision: 'unreviewed-revision' }),
  )
  const setup = setupStoreFixture(project, newerDocument, reviewed)
  const reply = await saveManualSetup(
    { projectId: 'project-1', requestId: 'setup-save', source },
    setup.store,
  )

  assert.equal(reply.type, 'project.setup.editing')
  assert.equal(setup.checkpoint()?.documentRevision, SETUP_DOCUMENT_REVISION)
})
