import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseClaudeHistory } from './claude-history'

test('maps recorded Claude user and assistant text to stable history entries', () => {
  assert.deepEqual(
    parseClaudeHistory([
      {
        type: 'user',
        uuid: 'user-1',
        message: { content: 'Review this change.' },
      },
      {
        type: 'assistant',
        uuid: 'assistant-1',
        message: { content: [{ type: 'text', text: 'I will review it.' }] },
      },
      { type: 'assistant', uuid: 'unsupported', message: { content: [] } },
    ]),
    [
      { sourceId: 'user-1', role: 'user', text: 'Review this change.' },
      { sourceId: 'assistant-1', role: 'assistant', text: 'I will review it.' },
    ],
  )
})
