import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SESSION_MOCK_ADVERSARIAL_SEED_ENV } from '@/harnesses/proof-protocol'
import { mockStartInput } from './mock-codex-channel.ts'
import { clientBackedByMock, mockCodexExecutable } from './mock-codex-driver.ts'
import { openLiveSession, waitFor } from './mock-codex-live-session.ts'

async function startSeeded(seed: string, prompt: string) {
  const client = clientBackedByMock(
    await mockCodexExecutable({ [SESSION_MOCK_ADVERSARIAL_SEED_ENV]: seed }),
  )
  return { client, session: openLiveSession(client, { ...mockStartInput, prompt }) }
}

test('a seeded Codex reply survives a split through a multi-byte character', async () => {
  const { client, session } = await startSeeded('alpha', 'Keep this complete.')
  try {
    await waitFor(() => session.has('turn.completed'))
    assert.deepEqual(session.assistantText().at(-1), 'Mock Codex read: Keep this complete. 🦜')
    assert.equal(session.statuses().at(-1), 'idle')
  } finally {
    session.channel.close()
    client.shutdown()
  }
})

test('a seeded Codex failure and stall stay visible as distinct adverse states', async () => {
  const failing = await startSeeded('seed-3', 'Fail this Turn.')
  const stalled = await startSeeded('seed-17', 'Stall this Turn.')
  try {
    await waitFor(() => failing.session.statuses().at(-1) === 'unknown')
    await waitFor(() => stalled.session.statuses().at(-1) === 'running')
    await new Promise((resolve) => setTimeout(resolve, 150))
    assert.equal(failing.session.statuses().at(-1), 'unknown')
    assert.equal(failing.session.has('turn.completed'), true)
    assert.equal(stalled.session.statuses().at(-1), 'running')
    assert.equal(stalled.session.has('turn.completed'), false)
  } finally {
    for (const { client, session } of [failing, stalled]) {
      session.channel.close()
      client.shutdown()
    }
  }
})
