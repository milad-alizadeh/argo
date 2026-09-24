import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCodexHistory } from './codex-history'

test('maps recorded Codex thread items and direct active status', () => {
  assert.deepEqual(
    parseCodexHistory(
      {
        thread: {
          id: 'thread-1',
          status: { type: 'active', activeFlags: [] },
          turns: [
            {
              id: 'turn-1',
              items: [
                {
                  id: 'user-1',
                  type: 'userMessage',
                  content: [{ type: 'text', text: 'Review this.' }],
                },
                { id: 'assistant-1', type: 'agentMessage', text: 'I will review it.' },
              ],
            },
          ],
        },
      },
      'thread-1',
    ),
    {
      availability: {
        state: 'unavailable',
        reason: 'This Codex Session is active in another app.',
      },
      entries: [
        { sourceId: 'user-1', role: 'user', text: 'Review this.' },
        { sourceId: 'assistant-1', role: 'assistant', text: 'I will review it.' },
      ],
    },
  )
})

test('keeps a partial Codex history unknown', () => {
  assert.throws(
    () => parseCodexHistory({ thread: { id: 'thread-1', status: { type: 'idle' } } }, 'thread-1'),
    /turns/,
  )
})
