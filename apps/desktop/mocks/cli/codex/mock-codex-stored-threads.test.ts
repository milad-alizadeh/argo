import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockStartInput } from './mock-codex-channel.ts'
import { clientBackedByMock, mockCodexExecutable } from './mock-codex-driver.ts'
import { openLiveSession, waitFor } from './mock-codex-live-session.ts'
import { recordedCall, recordedCalls, recordedThreads } from './recorded-codex-threads.ts'

const identity = (value: unknown) => value

test('answers stored history with the recorded app-server responses', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  try {
    const listed = recordedCall('thread/list')
    assert.deepEqual(await client.request('thread/list', {}, identity), listed.result)
    const read = recordedCall('thread/read')
    assert.deepEqual(await client.request('thread/read', read.params, identity), read.result)
    // The mock pages a thread as Codex did; only its cursors are its own.
    for (const thread of recordedThreads()) {
      const recordedPages = recordedCalls('thread/turns/list').filter(
        (call) => call.params.threadId === thread.id,
      )
      const pages: unknown[] = []
      let cursor: string | null = null
      do {
        const params = { threadId: thread.id, limit: 1, itemsView: 'full', sortDirection: 'asc' }
        const page = (await client.request(
          'thread/turns/list',
          { ...params, cursor },
          identity,
        )) as {
          data: unknown[]
          nextCursor: string | null
        }
        pages.push(page.data)
        cursor = page.nextCursor
      } while (cursor !== null)
      assert.deepEqual(
        pages,
        recordedPages.map((call) => call.result.data),
      )
    }
  } finally {
    client.shutdown()
  }
})

test('lists and reads a thread it started beside the recorded ones', async () => {
  const client = clientBackedByMock(await mockCodexExecutable())
  const session = openLiveSession(client, { ...mockStartInput, prompt: 'Remember this prompt.' })
  try {
    await waitFor(() => session.has('turn.completed'))
    const threadId = session.nativeId()
    assert.ok(threadId)
    const listed = (await client.request('thread/list', {}, identity)) as {
      data: { id: string }[]
    }
    const recorded = recordedCall('thread/list').result
    assert.deepEqual(
      listed.data.map((thread) => thread.id),
      [threadId, ...recorded.data.map((thread) => thread.id)],
    )
    const turns = (await client.request('thread/turns/list', { threadId }, identity)) as {
      data: { items: { type: string; content?: { text: string }[] }[] }[]
    }
    const prompts = turns.data.flatMap((turn) =>
      turn.items.flatMap((item) => (item.type === 'userMessage' ? (item.content ?? []) : [])),
    )
    assert.deepEqual(
      prompts.map((part) => part.text),
      ['Remember this prompt.'],
    )
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
