import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'
import { ClaudeLiveText } from './claude-live-text'

// Captured from a Claude Agent SDK query with includePartialMessages on 2026-09-28.
test('builds a stable assistant row from recorded Claude Agent SDK stream events', () => {
  const recorded = readFileSync(
    new URL('./fixtures/claude-live-stream.jsonl', import.meta.url),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Extract<SDKMessage, { type: 'stream_event' }>)
  const [start, first, second, settled] = recorded
  if (start === undefined || first === undefined || second === undefined || settled === undefined)
    throw new Error('Recorded Claude stream is incomplete.')
  const stream = new ClaudeLiveText()
  expect(stream.append(start)).toBeNull()
  expect(stream.append(first)).toMatchObject({
    id: 'msg_011CfUn1LYTswFg4iiVyNh4i:1',
    text: 'A file reader opens',
  })
  expect(stream.append(second)).toMatchObject({
    id: 'msg_011CfUn1LYTswFg4iiVyNh4i:1',
    text: 'A file reader opens files stored',
  })
  stream.settle('msg_011CfUn1LYTswFg4iiVyNh4i')
  expect(stream.append(settled)).toBeNull()
})
