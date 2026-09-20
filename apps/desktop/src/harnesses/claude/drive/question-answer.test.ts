import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import { deliverAnswer } from '@/harnesses/claude/drive/question-answer'

const DOWN = '[B'
const noWait = async () => {}

function target() {
  const writes: string[] = []
  return { target: { process: { write: (text: string) => writes.push(text) } }, writes }
}

// Confirmed against the real Harness: Down to the row (the picker opens on row 1), then Enter.
test('answers a single-select question with Down to the row and Enter', async () => {
  const { target: session, writes } = target()
  const answer: QuestionAnswer = { kind: 'options', indices: [3] }

  await deliverAnswer(session, [answer], noWait)

  assert.deepEqual(writes, [DOWN, DOWN, '\r'])
})

test('answers row one with no Down presses at all', async () => {
  const { target: session, writes } = target()

  await deliverAnswer(session, [{ kind: 'options', indices: [1] }], noWait)

  assert.deepEqual(writes, ['\r'])
})

// Best-effort, UNVERIFIED against a real multi-select probe (see question-answer.ts): each target
// row is visited in ascending order off one shared cursor, Space toggles it, one final Enter submits.
test('answers a multi-select question by visiting each row and toggling it with Space', async () => {
  const { target: session, writes } = target()
  const answer: QuestionAnswer = { kind: 'options', indices: [1, 3] }

  await deliverAnswer(session, [answer], noWait)

  assert.deepEqual(writes, [' ', DOWN, DOWN, ' ', '\r'])
})

// The free-text row sits one past the last offered option; selecting it, Enter, typing, Enter.
test('answers a free-text question by selecting its row, typing, then submitting', async () => {
  const { target: session, writes } = target()
  const answer: QuestionAnswer = { kind: 'text', index: 4, text: 'Something else' }

  await deliverAnswer(session, [answer], noWait)

  assert.deepEqual(writes, [DOWN, DOWN, DOWN, '\r', 'Something else', '\r'])
})

test('delivers each question in a multi-question row in order', async () => {
  const { target: session, writes } = target()

  await deliverAnswer(
    session,
    [
      { kind: 'options', indices: [2] },
      { kind: 'options', indices: [1] },
    ],
    noWait,
  )

  assert.deepEqual(writes, [DOWN, '\r', '\r'])
})
