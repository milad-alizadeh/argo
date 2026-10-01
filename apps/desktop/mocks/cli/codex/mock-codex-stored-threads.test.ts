import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockStartInput } from './mock-codex-channel.ts'
import { clientBackedByMock, mockCodexExecutable, waitFor } from './mock-codex-driver.ts'
import { openLiveSession } from './mock-codex-live-session.ts'
import { recordedCall } from './recorded-codex-threads.ts'

const identity = (value: unknown) => value

test('answers stored history with the recorded app-server responses', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  try {
    const listed = recordedCall('thread/list')
    assert.deepEqual(await client.request('thread/list', {}, identity), listed.result)
    const read = recordedCall('thread/read')
    assert.deepEqual(await client.request('thread/read', read.params, identity), read.result)
    const turns = recordedCall('thread/turns/list')
    assert.deepEqual(
      await client.request('thread/turns/list', turns.params, identity),
      turns.result,
    )
  } finally {
    client.shutdown()
  }
})

test('lists and reads a thread it started beside the recorded ones', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  const session = openLiveSession(client, { ...mockStartInput, prompt: 'Remember this prompt.' })
  try {
    await waitFor(() => session.has('turn.completed'), 'the Turn to complete')
    const threadId = session.nativeId()
    assert.ok(threadId)
    const listed = (await client.request('thread/list', {}, identity)) as {
      data: { id: string }[]
    }
    const recorded = recordedCall('thread/list').result as { data: { id: string }[] }
    assert.deepEqual(
      listed.data.map((thread) => thread.id),
      [threadId, ...recorded.data.map((thread) => thread.id)],
    )
    const read = (await client.request('thread/read', { threadId }, identity)) as {
      thread: { turns: { items: { type: string; content?: { text: string }[] }[] }[] }
    }
    const prompts = read.thread.turns.flatMap((turn) =>
      turn.items.flatMap((item) => (item.type === 'userMessage' ? (item.content ?? []) : [])),
    )
    assert.deepEqual(
      prompts.map((part) => part.text),
      ['Remember this prompt.'],
    )
    const listedTurns = (await client.request('thread/turns/list', { threadId }, identity)) as {
      data: unknown[]
    }
    assert.deepEqual(listedTurns.data, read.thread.turns)
  } finally {
    session.channel.close()
    client.shutdown()
  }
})

test('refuses a thread neither recorded nor started', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  try {
    await assert.rejects(
      client.request('thread/read', { threadId: 'missing-thread' }, identity),
      /not found/,
    )
  } finally {
    client.shutdown()
  }
})
