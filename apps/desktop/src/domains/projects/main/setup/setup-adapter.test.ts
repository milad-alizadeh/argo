import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setupDocumentFixture } from '../../../../../test-fixtures/projects/setup-document.fixture'
import { parseSetupDocument } from '../../contract/setup-document'
import { type SetupAdapter, selectSetupAdapter, startSetupSession } from './setup-adapter'

const document = parseSetupDocument(setupDocumentFixture())

function adapter(overrides: Partial<SetupAdapter> = {}): SetupAdapter {
  return {
    id: 'claude',
    available: async () => true,
    start: async () => ({ sessionId: 'setup-session' }),
    ...overrides,
  }
}

test('selects only a registered Setup adapter that is available on this machine', async () => {
  const available = adapter()
  const unavailable = adapter({ id: 'codex', available: async () => false })

  assert.equal(await selectSetupAdapter([available], 'claude'), available)
  assert.equal(await selectSetupAdapter([available], 'codex'), null)
  assert.equal(await selectSetupAdapter([unavailable], 'codex'), null)
})

test('starts the selected Setup agent in the dedicated worktree with a valid Setup document', async () => {
  const started: Array<{ worktreePath: string; documentRevision: string }> = []
  const selected = adapter({
    start: async ({ worktreePath, document: received }) => {
      started.push({ worktreePath, documentRevision: received.revision })
      return { sessionId: 'claude-setup-session' }
    },
  })

  const result = await startSetupSession({
    adapters: [selected],
    adapterId: 'claude',
    worktreePath: '/projects/argo/.argo/worktrees/setup-project-1',
    document,
  })

  assert.deepEqual(result, { sessionId: 'claude-setup-session' })
  assert.deepEqual(started, [
    {
      worktreePath: '/projects/argo/.argo/worktrees/setup-project-1',
      documentRevision: document.revision,
    },
  ])
})

test('does not start an unsupported or unavailable Setup adapter', async () => {
  const unavailable = adapter({ available: async () => false })

  assert.equal(
    await startSetupSession({
      adapters: [unavailable],
      adapterId: 'claude',
      worktreePath: '/projects/argo/.argo/worktrees/setup-project-1',
      document,
    }),
    null,
  )
})
