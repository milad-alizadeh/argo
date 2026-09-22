import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readTranscriptFile } from '@/domains/sessions/contract/model/transcript'
import { parseCodexTranscriptLine } from './records'

test('names a voice thread by the first thing the person said', () => {
  const said = (input: string) =>
    JSON.stringify({
      type: 'response_item',
      payload: {
        type: 'message',
        id: `said-${input}`,
        role: 'user',
        content: [
          { type: 'input_text', text: '<recommended_plugins>\n- Figma\n</recommended_plugins>' },
          {
            type: 'input_text',
            text: `<realtime_delegation><input>${input}</input></realtime_delegation>`,
          },
        ],
      },
    })
  const file = readTranscriptFile('/tmp/voice.jsonl', {
    sessionId: 'voice',
    lines: [said('\nTighten the typography\n'), said('And the spacing')],
    parse: parseCodexTranscriptLine,
  })
  assert.equal(file.openingPrompt, 'Tighten the typography')
})
