import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setupStoreFixture } from '../../../../../test-fixtures/projects/setup/setup-store.fixture'
import { setupWorktreeFixture } from '../../../../../test-fixtures/projects/setup/setup-worktree.fixture'
import { setupDocumentFixture } from '../../../../../test-fixtures/projects/setup-document.fixture'
import { parseSetupDocument } from '../../contract/setup-document'
import { beginManualSetup } from './manual-setup'

const document = parseSetupDocument(setupDocumentFixture())

test('starts one available Setup agent in the dedicated worktree and keeps its Session on restart', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const setup = setupStoreFixture(project, document)
  const started: string[] = []
  setup.store.setupAdapters.push({
    id: 'claude',
    available: async () => true,
    start: async ({ worktreePath }) => {
      started.push(worktreePath)
      return { sessionId: 'claude-setup-session' }
    },
  })
  const first = await beginManualSetup(
    { projectId: 'project-1', requestId: 'setup-1' },
    setup.store,
  )
  const resumed = await beginManualSetup(
    { projectId: 'project-1', requestId: 'setup-2' },
    setup.store,
  )
  assert.equal(
    first.type === 'project.setup.editing' ? first.sessionId : null,
    'claude-setup-session',
  )
  assert.equal(resumed.type, 'project.setup.editing')
  assert.deepEqual(started, [setup.checkpoint()?.worktreePath])
})

test('refuses Setup when no supported agent is available', async (context) => {
  const { project } = await setupWorktreeFixture(context)
  const setup = setupStoreFixture(project, document)
  setup.store.setupAdapters.push({
    id: 'claude',
    available: async () => false,
    start: async () => ({ sessionId: 'not-started' }),
  })
  const reply = await beginManualSetup(
    { projectId: 'project-1', requestId: 'setup-1' },
    setup.store,
  )
  assert.equal(reply.type === 'project.error' ? reply.code : null, 'setup-agent-unavailable')
})
