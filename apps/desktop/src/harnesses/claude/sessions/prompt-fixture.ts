import assert from 'node:assert/strict'
import { parseTranscriptLine } from '@/harnesses/claude/sessions/records'
import { rowsOfRecord } from '@/harnesses/session/feed'

// The Feed rows one transcript message draws, read through the real parser.
export function promptRows(content: unknown, role: 'user' | 'assistant' = 'user') {
  const record = parseTranscriptLine(
    JSON.stringify({ type: role, uuid: 'prompt-1', message: { role, content } }),
  )
  if (record === null) assert.fail('expected the message to parse')
  return rowsOfRecord(record, '0:0', { results: new Map(), skillBodies: new Map() })
}
