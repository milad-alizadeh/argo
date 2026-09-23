import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createAdapter,
  createMockAdapter,
  mockCodexExecutable,
  waitFor,
} from './mock-codex-session-adapter-support.ts'

async function start(adapter: Awaited<ReturnType<typeof createMockAdapter>>, prompt: string) {
  const outcome = await adapter.execute({
    type: 'session.start',
    harness: 'codex',
    prompt,
    workspace: { kind: 'main' },
  })
  assert.equal(outcome.kind, 'accepted')
  if (outcome.kind !== 'accepted') throw new Error('Codex did not start the managed Session')
  return outcome.projection.session
}

test('releases the lease when app-server unloads a managed thread', async () => {
  const released: string[] = []
  const adapter = await createMockAdapter(released)
  try {
    const session = await start(adapter, 'Start before app-server unloads the managed thread.')
    await adapter.execute({ type: 'session.send', session, prompt: 'NOT_LOADED' })
    await waitFor(() => released.includes(session.nativeId))
  } finally {
    await adapter.close()
  }
})

test('releases the lease when app-server closes a managed thread', async () => {
  const released: string[] = []
  const adapter = await createMockAdapter(released)
  try {
    const session = await start(adapter, 'Start before app-server closes the managed thread.')
    await adapter.execute({ type: 'session.send', session, prompt: 'CLOSED' })
    await waitFor(() => released.includes(session.nativeId))
  } finally {
    await adapter.close()
  }
})

test('unsubscribes before it releases a closed managed Session lease', async () => {
  const released: string[] = []
  const adapter = await createMockAdapter(released)
  try {
    const session = await start(adapter, 'Close this managed Session.')
    const closed = await adapter.execute({ type: 'session.close', session })
    assert.equal(closed.kind, 'accepted')
    await waitFor(() => released.includes(session.nativeId))
  } finally {
    await adapter.close()
  }
})

test('does not share an app-server process between different executables', async () => {
  const first = createAdapter(await mockCodexExecutable())
  const second = createAdapter(await mockCodexExecutable())
  try {
    const [one, two] = await Promise.all([
      start(first, 'First isolated Session.'),
      start(second, 'Second isolated Session.'),
    ])
    assert.equal(one.nativeId, two.nativeId)
  } finally {
    await first.close()
    await second.close()
  }
})
