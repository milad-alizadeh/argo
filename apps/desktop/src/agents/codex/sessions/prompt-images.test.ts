import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rowsOfRecord } from '@/core/sessions/feed'
import { parseCodexTranscriptLine } from './records'

function eventRows(payload: Record<string, unknown>) {
  const record = parseCodexTranscriptLine(
    JSON.stringify({ timestamp: '2026-09-15T10:00:00.000Z', type: 'event_msg', payload }),
  )
  if (record === null) assert.fail('expected the prompt to parse')
  return rowsOfRecord(record, '0:0', { results: new Map(), skillBodies: new Map() })
}

const promptRows = (content: unknown[]) =>
  eventRows({
    type: 'item_completed',
    thread_id: 'thread-1',
    item: { type: 'UserMessage', id: 'prompt-1', content },
  })

// The event `codex exec -i` wrote under codex-cli 0.147.0, with its path shortened.
const EXEC_PROMPT = {
  type: 'user_message',
  message: 'Reply with the single word OK.',
  images: [],
  local_images: ['/Users/x/dot.png'],
  audio: [],
  local_audio: [],
  text_elements: [],
}

test('draws the image file a bare prompt event attached inside its bubble', () => {
  assert.deepEqual(eventRows(EXEC_PROMPT), [
    {
      shape: 'prose',
      id: 'user:2026-09-15T10:00:00.000Z:0',
      role: 'user',
      text: 'Reply with the single word OK.',
      images: ['file:///Users/x/dot.png'],
    },
  ])
})

test('draws inline image bytes a bare prompt event carries before its files', () => {
  const rows = eventRows({ ...EXEC_PROMPT, images: ['data:image/png;base64,iVBORw0KGgo=', 'x'] })
  assert.deepEqual(rows[0]?.shape === 'prose' ? rows[0].images : null, [
    'data:image/png;base64,iVBORw0KGgo=',
    'file:///Users/x/dot.png',
  ])
})

test('draws a prompt image and a local image file inside the prompt bubble', () => {
  const rows = promptRows([
    { type: 'text', text: 'Fix the spacing', text_elements: [] },
    { type: 'image', image_url: 'data:image/png;base64,iVBORw0KGgo=' },
    { type: 'local_image', path: '/Users/x/generated/a b.png' },
  ])
  assert.deepEqual(rows, [
    {
      shape: 'prose',
      id: 'prompt-1:0',
      role: 'user',
      text: 'Fix the spacing',
      images: ['data:image/png;base64,iVBORw0KGgo=', 'file:///Users/x/generated/a%20b.png'],
    },
  ])
})

test('keeps an image it cannot draw as its source', () => {
  const rows = promptRows([
    { type: 'text', text: 'Look', text_elements: [] },
    { type: 'image', image_url: 'https://example.com/a.png' },
  ])
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'source'],
  )
})
