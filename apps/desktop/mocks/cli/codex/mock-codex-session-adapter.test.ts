import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { SESSION_MOCK_REPLY_DELAY_MS_ENV } from '@/harnesses/proof-protocol'
import { mockStartInput } from './mock-codex-channel.ts'
import { clientBackedByMock, mockCodexExecutable } from './mock-codex-driver.ts'
import { openLiveSession, waitFor } from './mock-codex-live-session.ts'

test('queues a follow-up Send until the active Turn settles', async () => {
  const client = clientBackedByMock(
    await mockCodexExecutable({ [SESSION_MOCK_REPLY_DELAY_MS_ENV]: '200' }),
  )
  const session = openLiveSession(client)
  try {
    await waitFor(() => session.has('turn.started'))
    const followUp = { ...mockStartInput, commandId: randomUUID(), prompt: 'Send while running.' }
    await session.channel.submit(followUp)
    await waitFor(
      () => session.events.filter((event) => event.type === 'turn.completed').length === 2,
    )
    const boundaries = session.events.flatMap((event) =>
      event.type === 'turn.started' || event.type === 'turn.completed'
        ? [`${event.type} ${event.commandId}`]
        : [],
    )
    assert.deepEqual(boundaries, [
      `turn.started ${mockStartInput.commandId}`,
      `turn.completed ${mockStartInput.commandId}`,
      `turn.started ${followUp.commandId}`,
      `turn.completed ${followUp.commandId}`,
    ])
  } finally {
    session.channel.close()
    client.shutdown()
  }
})

test('shares one app-server process across managed Session windows', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  const first = openLiveSession(client, { ...mockStartInput, prompt: 'First Session.' })
  const second = openLiveSession(client, { ...mockStartInput, prompt: 'Second Session.' })
  try {
    await waitFor(() => first.nativeId() !== undefined && second.nativeId() !== undefined)
    assert.notEqual(first.nativeId(), second.nativeId())
  } finally {
    first.channel.close()
    second.channel.close()
    client.shutdown()
  }
})

test('projects an app-server tool call into the Feed', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  const session = openLiveSession(client, { ...mockStartInput, prompt: 'PROJECT_TOOL_USAGE' })
  try {
    const toolCalls = () =>
      session
        .feed()
        .flatMap((body) =>
          body.type === 'content' && body.content.kind === 'command'
            ? [{ turnId: body.turnId, content: body.content }]
            : [],
        )
    await waitFor(() => toolCalls().length > 0)
    assert.equal(toolCalls().length, 1)
    assert.equal(toolCalls()[0]?.content.command, 'rtk bun run typecheck')
    assert.equal(toolCalls()[0]?.content.status, 'running')
    assert.equal(toolCalls()[0]?.turnId?.startsWith('mock-turn-'), true)
  } finally {
    session.channel.close()
    client.shutdown()
  }
})
