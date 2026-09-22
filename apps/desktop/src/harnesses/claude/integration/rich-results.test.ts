import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertRichResult } from '@/domains/sessions/main/projection/feed/rich-result-test-assertion'
import { parseTranscriptLine } from '../sessions/records/records'

test('keeps array-valued tool result text and images in source order', () => {
  const record = parseTranscriptLine(
    JSON.stringify({
      type: 'user',
      uuid: 'result-1',
      message: {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'call-1',
            content: [
              { type: 'text', text: 'before' },
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
              { type: 'text', text: 'after' },
            ],
          },
        ],
      },
    }),
  )
  assert.equal(record?.kind, 'message')
  if (record?.kind !== 'message') assert.fail('expected a tool result message')
  assertRichResult(record.toolResults?.[0]?.blocks)
})
