import { expect, test } from 'vitest'
import { SessionInteractionBroker } from './session-interaction-broker'

test('holds a Claude permission until the matching Session decision arrives', async () => {
  const broker = new SessionInteractionBroker()
  const pending = broker.requestPermission({
    nativeId: 'claude-1',
    requestId: 'request-1',
    description: 'Read a file',
    signal: new AbortController().signal,
  })
  expect(broker.permission('claude-1')).toEqual({
    requestId: 'request-1',
    description: 'Read a file',
  })
  expect(broker.decidePermission('claude-2', 'request-1', 'allow')).toBe(false)
  expect(broker.decidePermission('claude-1', 'request-1', 'allow')).toBe(true)
  await expect(pending).resolves.toBe('allow')
  expect(broker.permission('claude-1')).toBeNull()
})

test('cancels a pending Question when Claude aborts it', async () => {
  const broker = new SessionInteractionBroker()
  const controller = new AbortController()
  const pending = broker.requestQuestion({
    nativeId: 'claude-1',
    requestId: 'question-1',
    questions: [{ question: 'Which file?', header: null, multiSelect: false, options: [] }],
    signal: controller.signal,
  })
  controller.abort()
  await expect(pending).rejects.toThrow('cancelled')
  expect(
    broker.decideQuestion('claude-1', 'question-1', [{ kind: 'text', index: 1, text: 'a' }]),
  ).toBe(false)
})
