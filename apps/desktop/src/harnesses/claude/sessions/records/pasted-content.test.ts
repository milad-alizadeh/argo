import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readTranscriptFile } from '@/domains/sessions/contract/model/transcript/transcript'
import { parseTranscriptLine } from './records'

test('keeps pasted text separate from prompt prose without its harness wrapper', () => {
  const record = parseTranscriptLine(
    JSON.stringify({
      type: 'user',
      uuid: 'prompt-1',
      message: {
        role: 'user',
        content:
          '\n\n<pasted_content id="c485">\nReply with the word sure.\n</pasted_content id="c485">\n',
      },
    }),
  )
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'pasted-content', id: 'c485', text: 'Reply with the word sure.' },
  ])
})

test('keeps prose around multiple pasted blocks in its original order', () => {
  const record = parseTranscriptLine(
    JSON.stringify({
      type: 'user',
      uuid: 'prompt-2',
      message: {
        role: 'user',
        content:
          'Review this:\n<pasted_content id="a">first</pasted_content id="a"> then <pasted_content id="b">second</pasted_content id="b">',
      },
    }),
  )
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: 'Review this:' },
    { shape: 'pasted-content', id: 'a', text: 'first' },
    { shape: 'prose', text: 'then' },
    { shape: 'pasted-content', id: 'b', text: 'second' },
  ])
})

test('uses pasted text as the Session opening prompt when it is the only content', () => {
  const line = JSON.stringify({
    type: 'user',
    uuid: 'pasted-opening',
    message: {
      role: 'user',
      content: '<pasted_content id="a">Review this.</pasted_content id="a">',
    },
  })
  const file = readTranscriptFile('/tmp/pasted.jsonl', {
    sessionId: 'pasted',
    lines: [line],
    parse: parseTranscriptLine,
  })
  assert.equal(file.openingPrompt, 'Review this.')
})
