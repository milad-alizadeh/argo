import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nestedToolCall } from './nested-tool-call'

test('reads the one tool call in a Codex execution wrapper', () => {
  assert.deepEqual(
    nestedToolCall(
      'const result = await tools.update_plan({ plan: [{ step: "Inspect", status: "in_progress" }] });\ntext(result);',
    ),
    {
      name: 'update_plan',
      argumentsText: '{ plan: [{ step: "Inspect", status: "in_progress" }] }',
    },
  )
})

test('does not treat a later or quoted tool name as the wrapper call', () => {
  assert.equal(nestedToolCall('const note = "tools.update_plan({})";'), null)
  assert.equal(nestedToolCall('// tools.update_plan({})\ntext("done");'), null)
})
