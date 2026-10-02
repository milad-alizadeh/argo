import { expect, test } from 'bun:test'
import { controlRequestId, permissionResponseId, promptText } from './mock-claude-sdk-stream'

test('reads the SDK user prompt from string content', () => {
  expect(
    promptText({
      type: 'user',
      message: { role: 'user', content: 'Reply with one short acknowledgement.' },
    }),
  ).toBe('Reply with one short acknowledgement.')
})

test('reads the SDK response that resolves a permission request', () => {
  expect(
    permissionResponseId({
      type: 'control_response',
      response: { request_id: 'permission-1', subtype: 'success' },
    }),
  ).toBe('permission-1')
})

test('reads the SDK initialization request', () => {
  expect(
    controlRequestId(
      {
        type: 'control_request',
        request_id: 'init-1',
        request: { subtype: 'initialize' },
      },
      'initialize',
    ),
  ).toBe('init-1')
})
