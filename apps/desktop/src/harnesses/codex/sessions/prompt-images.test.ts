import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rowsOfRecord } from '@/domains/sessions/main/projection/feed'
import { parseCodexTranscriptLine } from '@/harnesses/codex/sessions/records'

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

// The event `codex exec -i` wrote under codex-harness 0.147.0, with its path shortened.
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
      images: ['argo-attachment://local/Users/x/dot.png'],
    },
  ])
})

test('draws inline image bytes a bare prompt event carries before its files', () => {
  const rows = eventRows({ ...EXEC_PROMPT, images: ['data:image/png;base64,iVBORw0KGgo=', 'x'] })
  assert.deepEqual(rows[0]?.shape === 'prose' ? rows[0].images : null, [
    'data:image/png;base64,iVBORw0KGgo=',
    'argo-attachment://local/Users/x/dot.png',
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
      images: [
        'data:image/png;base64,iVBORw0KGgo=',
        'argo-attachment://local/Users/x/generated/a%20b.png',
      ],
    },
  ])
})

// The TUI's own submission (composer_submission.rs, rust-v0.147.0): images first, then one text
// holding `[Image #N]` where each sat, marked by a `text_elements` byte range.
const placeholder = (start: number, text = '[Image #2]') => ({
  byte_range: { start, end: start + Buffer.byteLength(text) },
  placeholder: text,
})

test('draws a TUI prompt image without the placeholder the TUI wrote for it', () => {
  const rows = promptRows([
    { type: 'local_image', path: '/Users/x/a.png' },
    { type: 'text', text: '[Image #2] submit mixed', text_elements: [placeholder(0)] },
  ])
  assert.deepEqual(rows[0]?.shape === 'prose' ? [rows[0].text, rows[0].images] : null, [
    'submit mixed',
    ['argo-attachment://local/Users/x/a.png'],
  ])
})

test('keeps a placeholder the sentence refers to, and one the TUI did not mark', () => {
  const text = 'né [Image #2] ok [Image #3]'
  const rows = promptRows([
    { type: 'local_image', path: '/Users/x/a.png' },
    { type: 'text', text, text_elements: [placeholder(Buffer.byteLength('né '))] },
  ])
  assert.equal(rows[0]?.shape === 'prose' ? rows[0].text : null, text)
})

test('drops the placeholders a bare prompt event marks at its end', () => {
  const message = 'look é [Image #2]'
  const rows = eventRows({
    ...EXEC_PROMPT,
    message,
    text_elements: [placeholder(Buffer.byteLength('look é '))],
  })
  assert.equal(rows[0]?.shape === 'prose' ? rows[0].text : null, 'look é')
})

// The event the app-server wrote for Argo's `inputItemsFor` under codex-harness 0.147.0: every text
// item joined with no separator, and each marked range moved onto the joined message.
test('draws the files Argo marked in a bare prompt event as chips, not as words', () => {
  const rows = eventRows({
    ...EXEC_PROMPT,
    message: 'Review é./Users/x/a.md/Users/x/my notes.md',
    local_images: [],
    text_elements: [
      placeholder(Buffer.byteLength('Review é.'), '/Users/x/a.md'),
      placeholder(Buffer.byteLength('Review é./Users/x/a.md'), '/Users/x/my notes.md'),
    ],
  })
  assert.deepEqual(rows[0]?.shape === 'prose' ? [rows[0].text, rows[0].files] : null, [
    'Review é.',
    ['/Users/x/a.md', '/Users/x/my notes.md'],
  ])
})

test('draws the files Argo marked in their own path items, not as words', () => {
  const rows = promptRows([
    { type: 'text', text: '/Users/x/typed.md', text_elements: [] },
    { type: 'local_image', path: '/Users/x/a.png' },
    {
      type: 'text',
      text: '/Users/x/my notes.md',
      text_elements: [placeholder(0, '/Users/x/my notes.md')],
    },
  ])
  assert.deepEqual(rows, [
    {
      shape: 'prose',
      id: 'prompt-1:0',
      role: 'user',
      text: '/Users/x/typed.md',
      images: ['argo-attachment://local/Users/x/a.png'],
      files: ['/Users/x/my notes.md'],
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
