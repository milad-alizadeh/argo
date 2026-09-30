import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockStartInput } from './mock-codex-channel.ts'
import { clientBackedByMock, mockCodexExecutable, waitFor } from './mock-codex-driver.ts'
import { openLiveSession } from './mock-codex-live-session.ts'

const SETTLE_MS = 150

const pause = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS))

// A live channel holds no lease to release, so these cover what it does when app-server unloads or
// closes its thread.
for (const [verb, prompt] of [
  ['unloaded', 'NOT_LOADED'],
  ['closed', 'CLOSED'],
] as const) {
  test(`an ${verb} managed thread claims no status and leaves the channel open`, async () => {
    const client = clientBackedByMock(await mockCodexExecutable())
    const session = openLiveSession(client, { ...mockStartInput, prompt })
    try {
      await waitFor(() => session.statuses().length > 0, 'the Turn to start')
      await pause()
      assert.equal(session.statuses().at(-1), 'running')
      assert.equal(session.has('closed'), false)
      assert.equal(session.has('failure'), false)
    } finally {
      session.channel.close()
      client.shutdown()
    }
  })
}

test('unsubscribes when it closes a managed Session', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  const session = openLiveSession(client, {
    ...mockStartInput,
    prompt: 'Close this managed Session.',
  })
  try {
    await waitFor(() => session.has('turn.started'), 'the Turn to start')
    session.channel.close()
    const emitted = session.events.length
    assert.equal(session.events.at(-1)?.type, 'closed')
    await pause()
    assert.equal(session.events.length, emitted)
  } finally {
    client.shutdown()
  }
})

test('does not share an app-server process between different executables', async () => {
  const firstClient = clientBackedByMock(await mockCodexExecutable())
  const secondClient = clientBackedByMock(await mockCodexExecutable())
  const first = openLiveSession(firstClient, {
    ...mockStartInput,
    prompt: 'First isolated Session.',
  })
  const second = openLiveSession(secondClient, {
    ...mockStartInput,
    prompt: 'Second isolated Session.',
  })
  try {
    await waitFor(() => first.nativeId() !== undefined && second.nativeId() !== undefined)
    assert.equal(first.nativeId(), second.nativeId())
  } finally {
    first.channel.close()
    second.channel.close()
    firstClient.shutdown()
    secondClient.shutdown()
  }
})
