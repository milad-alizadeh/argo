import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setupDocumentFixture } from '../../../../test-fixtures/projects/setup-document.fixture'
import { parseSetupDocument } from '../../../domains/projects/contract/setup-document'
import { createClaudeSetupAdapter } from '../setup/setup-adapter'

const document = parseSetupDocument(setupDocumentFixture({ revision: 'setup-revision' }))

test('starts a visible Claude Setup Session in the dedicated worktree', async () => {
  const started: Array<{ cwd: string; prompt: string }> = []
  const sent: Array<{ sessionId: string; prompt: string }> = []
  const adapter = createClaudeSetupAdapter(
    {
      start: ({ cwd, prompt }) => {
        started.push({ cwd, prompt })
        return 'claude-setup-session'
      },
      send: async (sessionId, { prompt }) => {
        sent.push({ sessionId, prompt })
      },
    },
    () => true,
  )

  assert.equal(await adapter.available(), true)
  assert.deepEqual(
    await adapter.start({
      worktreePath: '/projects/argo/.argo/worktrees/setup-project-1',
      document,
    }),
    { sessionId: 'claude-setup-session' },
  )
  assert.equal(started[0]?.cwd, '/projects/argo/.argo/worktrees/setup-project-1')
  assert.match(started[0]?.prompt ?? '', /^\/goal /)
  assert.match(started[0]?.prompt ?? '', /onboarding form data/i)
  assert.deepEqual(
    sent.map(({ sessionId }) => sessionId),
    ['claude-setup-session'],
  )
  assert.match(sent[0]?.prompt ?? '', /setup-revision/)
  assert.match(sent[0]?.prompt ?? '', /Session Plan to record every proposed action/i)
  assert.match(
    sent[0]?.prompt ?? '',
    /Do not run a command or change a file before Argo records approval/i,
  )
})

test('does not present an unavailable Claude installation as a Setup agent', async () => {
  const adapter = createClaudeSetupAdapter(
    { start: () => 'not-started', send: async () => {} },
    () => false,
  )

  assert.equal(await adapter.available(), false)
})
