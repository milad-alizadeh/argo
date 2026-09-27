import { expect, test } from 'bun:test'
import type { SDKPartialAssistantMessage } from '@anthropic-ai/claude-agent-sdk'
import { ClaudeLiveText } from './claude-live-text'

function delta(uuid: string, index: number, text: string): SDKPartialAssistantMessage {
  return {
    type: 'stream_event',
    uuid,
    session_id: 'native-1',
    parent_tool_use_id: null,
    event: { type: 'content_block_delta', index, delta: { type: 'text_delta', text } },
  } as SDKPartialAssistantMessage
}

test('builds an assistant row incrementally under its vendor message identity', () => {
  const stream = new ClaudeLiveText()
  expect(stream.append(delta('assistant-1', 0, 'Read'))).toMatchObject({
    id: 'assistant-1',
    text: 'Read',
  })
  expect(stream.append(delta('assistant-1', 0, 'ing'))).toMatchObject({
    id: 'assistant-1',
    text: 'Reading',
  })
  expect(stream.append(delta('assistant-1', 1, 'tool'))).toMatchObject({
    id: 'assistant-1:1',
    text: 'tool',
  })
})
