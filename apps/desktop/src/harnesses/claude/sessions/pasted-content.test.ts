import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseTranscriptLine } from './records'

test('draws pasted text as the prompt, without the wrapper the Harness keeps it in', () => {
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
    { shape: 'prose', text: 'Reply with the word sure.' },
  ])
})
