import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readTranscriptFile } from '@/core/sessions/transcript'
import { parseTranscriptLine } from './records'

test('reads the compaction continuation preamble as a summary, not a prompt', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'compaction-summary',
    message: {
      role: 'user',
      content:
        'This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion...',
    },
  })
  assert.deepEqual(parseTranscriptLine(line), {
    kind: 'compaction-summary',
    uuid: 'compaction-summary',
    text: 'This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion...',
  })
})

test('folds the compaction continuation preamble into the boundary it follows', () => {
  const file = readTranscriptFile('/tmp/compaction.jsonl', {
    fileName: 'compaction.jsonl',
    lines: [
      '{"type":"system","subtype":"compact_boundary","uuid":"c-1"}',
      JSON.stringify({
        type: 'user',
        uuid: 'summary-1',
        message: {
          role: 'user',
          content: 'This session is being continued from a previous conversation, resuming.',
        },
      }),
    ],
    parse: parseTranscriptLine,
  })
  assert.deepEqual(file.records, [
    {
      kind: 'compaction',
      uuid: 'c-1',
      summary: 'This session is being continued from a previous conversation, resuming.',
    },
  ])
})
