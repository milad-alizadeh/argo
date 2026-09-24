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

test('keeps assistant prose beside tool use and counts unsupported blocks', () => {
  const warnings: string[] = []
  const originalWarn = console.warn
  console.warn = (message: string) => warnings.push(message)
  try {
    assert.deepEqual(
      parseClaudeHistory([
        {
          type: 'assistant',
          uuid: 'mixed-answer',
          message: {
            content: [
              { type: 'text', text: 'I will check this. ' },
              {
                type: 'tool_use',
                id: 'toolu_recorded',
                name: 'Read',
                input: { file_path: 'a.ts' },
              },
              { type: 'text', text: 'The result is clear.' },
              { type: 'text', text: 42 },
              { type: 'future_block', value: 'unrecognized' },
            ],
          },
        },
      ]),
      [
        {
          sourceId: 'mixed-answer',
          role: 'assistant',
          text: 'I will check this. The result is clear.',
        },
      ],
    )
    assert.deepEqual(warnings, ['Claude history contained 2 unsupported record or content shapes'])
  } finally {
    console.warn = originalWarn
  }
})
