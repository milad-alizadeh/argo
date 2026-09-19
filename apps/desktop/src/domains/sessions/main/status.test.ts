import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readExternalStatus } from '@/domains/sessions/main/status'
import { transcriptMessage } from '@/domains/sessions/main/transcript-test-fixtures'

test('a terminal Turn clears an unanswered question', () => {
  const question = transcriptMessage({
    uuid: 'question',
    toolCalls: [{ id: 'ask-1', name: 'AskUserQuestion', input: {} }],
  })
  for (const state of ['completed', 'aborted'] as const) {
    assert.equal(
      readExternalStatus(
        [question],
        [question, { kind: 'turn', uuid: `turn:${state}`, state, timestamp: null }],
      ),
      'idle',
    )
  }
})
