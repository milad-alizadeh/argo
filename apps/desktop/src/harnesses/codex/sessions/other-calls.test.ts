import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fed, feedRequest, rowsOf } from '@/domains/sessions/main/observation/reader/reader-test-helpers'
import { toolCallsOf } from '@/domains/sessions/main/projection/feed/tool-calls-of'
import { readerOverRollout } from './rollout-reader-test-helper'

test('draws orchestration and unknown tools as other, and no poll or wait', async (context) => {
  const reader = await readerOverRollout(context, {
    fixture: 'rollout-otherCalls.jsonl',
    session: 'otherCalls',
  })
  const rows = rowsOf(await fed(reader, feedRequest('otherCalls')))
  assert.deepEqual(
    toolCallsOf(rows).map(({ kind, label }) => ({ kind, label })),
    [
      { kind: 'tool', label: 'Updated the goal' },
      { kind: 'tool', label: 'Ran future_tool' },
    ],
  )
})
