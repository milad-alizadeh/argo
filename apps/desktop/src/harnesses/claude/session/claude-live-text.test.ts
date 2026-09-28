import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { ClaudeLiveText } from './claude-live-text'

// Captured from a Claude Agent SDK query with includePartialMessages on 2026-09-28.
test('builds a stable assistant row from recorded Claude Agent SDK stream events', () => {
  const recorded = readFileSync(
    new URL('./fixtures/claude-live-stream.jsonl', import.meta.url),
    'utf8',
  )
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as unknown)
  const stream = new ClaudeLiveText()
  expect(stream.append(recorded[0])).toBeNull()
  expect(stream.append(recorded[1])).toMatchObject({
    id: 'msg_011CfUn1LYTswFg4iiVyNh4i:1',
    text: 'A file reader opens',
  })
  expect(stream.append(recorded[2])).toMatchObject({
    id: 'msg_011CfUn1LYTswFg4iiVyNh4i:1',
    text: 'A file reader opens files stored',
  })
  stream.settle('msg_011CfUn1LYTswFg4iiVyNh4i')
  expect(stream.append(recorded[3])).toBeNull()
})
