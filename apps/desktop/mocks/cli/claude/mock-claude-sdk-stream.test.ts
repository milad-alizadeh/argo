import { expect, test } from 'bun:test'
import { promptText } from './mock-claude-sdk-stream'

test('reads the SDK user prompt from string content', () => {
  expect(
    promptText({
      type: 'user',
      message: { role: 'user', content: 'Reply with one short acknowledgement.' },
    }),
  ).toBe('Reply with one short acknowledgement.')
})
