import assert from 'node:assert/strict'
import { test } from 'node:test'
import { transcriptMessage } from '../../observation/tail/transcript-test-fixtures'
import { readExternalStatus } from './status'

test('a terminal Turn ends a pending ask', () => {
  const question = transcriptMessage({
    uuid: 'question',
    toolCalls: [
      {
        id: 'ask-1',
        kind: 'ask',
        questions: [],
        unsupported: null,
      },
    ],
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
