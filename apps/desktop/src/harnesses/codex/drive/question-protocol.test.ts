import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { WireMessage } from '@/harnesses/codex/drive/protocol'
import { codexAnswersFor, readRequestUserInput } from '@/harnesses/codex/drive/question-protocol'

function requestUserInput(): WireMessage {
  return {
    id: 0,
    method: 'item/tool/requestUserInput',
    params: {
      threadId: 'thread-1',
      turnId: 'turn-1',
      itemId: 'item-1',
      isBlocking: false,
      autoResolutionMs: null,
      questions: [
        {
          id: 'color',
          header: 'Color',
          question: 'Which color do you like?',
          isOther: true,
          isSecret: false,
          options: [
            { label: 'Red', description: 'Choose red.' },
            { label: 'Blue', description: 'Choose blue.' },
          ],
        },
      ],
    },
  }
}

test('reads a request_user_input notification into a shared-shape pending question', () => {
  const pending = readRequestUserInput(requestUserInput())
  assert.ok(pending)
  assert.equal(pending.threadId, 'thread-1')
  assert.equal(pending.turnId, 'turn-1')
  assert.equal(pending.itemId, 'item-1')
  assert.equal(pending.requestId, 0)
  assert.deepEqual(pending.answerIds, ['color'])
  assert.equal(pending.unsupported, null)
  assert.deepEqual(pending.questions, [
    {
      question: 'Which color do you like?',
      header: 'Color',
      multiSelect: false,
      options: [
        { label: 'Red', description: 'Choose red.' },
        { label: 'Blue', description: 'Choose blue.' },
      ],
    },
  ])
})

test('ignores every other notification', () => {
  assert.equal(
    readRequestUserInput({ method: 'thread/status/changed', params: { threadId: 'thread-1' } }),
    undefined,
  )
})

test('an isSecret question makes the whole pending question unsupported', () => {
  const message = requestUserInput()
  if ('method' in message && Array.isArray(message.params.questions)) {
    const [question] = message.params.questions as Array<Record<string, unknown>>
    if (question) question.isSecret = true
  }
  const pending = readRequestUserInput(message)
  assert.ok(pending?.unsupported)
})

test('rekeys a shared-shape options answer back into the id-keyed response Codex expects', () => {
  const pending = readRequestUserInput(requestUserInput())
  assert.ok(pending)
  const result = codexAnswersFor(pending, [{ kind: 'options', indices: [2] }])
  assert.deepEqual(result, { answers: { color: { answers: ['Blue'] } } })
})

test('rekeys a shared-shape text answer verbatim, ignoring its row position', () => {
  const pending = readRequestUserInput(requestUserInput())
  assert.ok(pending)
  const result = codexAnswersFor(pending, [{ kind: 'text', index: 3, text: 'Whatever is loaded.' }])
  assert.deepEqual(result, { answers: { color: { answers: ['Whatever is loaded.'] } } })
})
