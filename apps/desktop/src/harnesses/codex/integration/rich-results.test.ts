import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertRichResult } from '@/domains/sessions/main/projection/rich-result-test-assertion'
import { parseCodexTranscriptLine } from '../sessions/records'

test('keeps Codex tool result text and images in source order', () => {
  const record = parseCodexTranscriptLine(
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        id: 'result-1',
        call_id: 'call-1',
        output: [
          { type: 'input_text', text: 'before' },
          { type: 'input_image', image_url: 'data:image/png;base64,AAAA' },
          { type: 'input_text', text: 'after' },
        ],
      },
    }),
  )
  assert.equal(record?.kind, 'message')
  if (record?.kind !== 'message') assert.fail('expected a tool result message')
  assertRichResult(record.toolResults?.[0]?.blocks)
})
