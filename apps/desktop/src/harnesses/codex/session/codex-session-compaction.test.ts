import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mockCodexChannel } from '../../../../mocks/cli/codex/mock-codex-channel'
import type { CodexRequest } from '../app-server/codex-app-server-client'

test('Codex compaction runs after the active Turn and settles when its own Turn completes, past a late item of the Turn before', async () => {
  const calls: string[] = []
  const request = (async (method: string, _params: unknown, parse: (value: unknown) => unknown) => {
    calls.push(method)
    if (method === 'thread/start') return parse({ thread: { id: 'thread-1' } })
    if (method === 'turn/start') return parse({ turn: { id: 'turn-1' } })
    if (method === 'thread/compact/start') return parse({})
    throw new Error(`Unexpected request: ${method}`)
  }) as CodexRequest
  const { channel, events, notify } = mockCodexChannel(request)
  await new Promise((resolve) => setImmediate(resolve))
  let settled = false
  const compacted = channel.compact().then(() => {
    settled = true
  })
  assert.equal(calls.includes('thread/compact/start'), false)
  notify({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(calls.at(-1), 'thread/compact/start')
  const late = { id: 'reply-1', type: 'agentMessage', text: 'late', phase: null }
  notify({
    method: 'item/completed',
    params: { threadId: 'thread-1', turnId: 'turn-1', item: late },
  })
  const item = { id: 'compaction-1', type: 'contextCompaction' }
  notify({ method: 'item/started', params: { threadId: 'thread-1', turnId: 'turn-2', item } })
  notify({ method: 'item/completed', params: { threadId: 'thread-1', turnId: 'turn-2', item } })
  assert.equal(settled, false)
  notify({
    method: 'turn/completed',
    params: { threadId: 'thread-1', turn: { id: 'turn-2', status: 'completed' } },
  })
  await compacted
  assert.ok(
    events.some(
      (event) =>
        event.type === 'feed' &&
        event.body.type === 'content' &&
        event.body.content.kind === 'marker' &&
        event.body.content.marker === 'compaction',
    ),
  )
  channel.close()
})
