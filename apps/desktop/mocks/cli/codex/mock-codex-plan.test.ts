import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockStartInput } from './mock-codex-channel.ts'
import { clientBackedByMock, mockCodexExecutable } from './mock-codex-driver.ts'
import { openLiveSession, waitFor } from './mock-codex-live-session.ts'

// The live channel does not project `turn/plan/updated` into a Plan; this covers only that the
// notification, sent before the Turn starts, leaves the Turn intact.
test('a Turn that reports a Plan early still completes', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  const session = openLiveSession(client, {
    ...mockStartInput,
    prompt: 'PLAN_EARLY the Session projection.',
  })
  try {
    await waitFor(() => session.has('turn.completed'))
    assert.equal(session.statuses().at(-1), 'idle')
    assert.equal(session.has('failure'), false)
  } finally {
    session.channel.close()
    client.shutdown()
  }
})
