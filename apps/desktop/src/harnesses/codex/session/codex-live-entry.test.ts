import { expect, test } from 'bun:test'
import { codexLiveEntry } from './codex-session-machine'

test('Codex message deltas update one source entry and a completed item keeps its identity', () => {
  const fragments = new Map<string, string>()
  const first = codexLiveEntry(
    {
      method: 'item/agentMessage/delta',
      params: { threadId: 'thread-1', itemId: 'item-1', delta: 'Hel' },
    },
    'thread-1',
    fragments,
  )
  const second = codexLiveEntry(
    {
      method: 'item/agentMessage/delta',
      params: { threadId: 'thread-1', itemId: 'item-1', delta: 'lo' },
    },
    'thread-1',
    fragments,
  )
  const complete = codexLiveEntry(
    {
      method: 'item/completed',
      params: { threadId: 'thread-1', item: { type: 'agentMessage', id: 'item-1', text: 'Hello' } },
    },
    'thread-1',
    fragments,
  )
  expect([first, second, complete]).toEqual([
    { sourceId: 'item-1', role: 'assistant', text: 'Hel' },
    { sourceId: 'item-1', role: 'assistant', text: 'Hello' },
    { sourceId: 'item-1', role: 'assistant', text: 'Hello' },
  ])
})

test('Codex live reader ignores other threads and malformed notifications', () => {
  const fragments = new Map<string, string>()
  expect(
    codexLiveEntry(
      {
        method: 'item/agentMessage/delta',
        params: { threadId: 'other', itemId: 'item-1', delta: 'Other' },
      },
      'thread-1',
      fragments,
    ),
  ).toBeNull()
  expect(
    codexLiveEntry(
      { method: 'item/agentMessage/delta', params: { threadId: 'thread-1', itemId: 'item-1' } },
      'thread-1',
      fragments,
    ),
  ).toBeNull()
  expect(fragments.size).toBe(0)
})
