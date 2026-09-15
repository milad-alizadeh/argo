import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rowsOfRecord } from '@/core/sessions/feed'
import { parseTranscriptLine } from './records'

const PIXEL = 'iVBORw0KGgo='

function promptRows(content: unknown, role: 'user' | 'assistant' = 'user') {
  const record = parseTranscriptLine(
    JSON.stringify({ type: role, uuid: 'prompt-1', message: { role, content } }),
  )
  if (record === null) assert.fail('expected the message to parse')
  return rowsOfRecord(record, '0:0', { results: new Map(), skillBodies: new Map() })
}

const pasted = (data: string) => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/png', data },
})

test('draws a pasted image inside the prompt bubble without its placeholder', () => {
  const rows = promptRows([
    { type: 'text', text: '[Image #7] I asked to remove the indentation' },
    pasted(PIXEL),
  ])
  assert.deepEqual(rows, [
    {
      shape: 'prose',
      id: 'prompt-1:0',
      role: 'user',
      text: 'I asked to remove the indentation',
      images: [`data:image/png;base64,${PIXEL}`],
    },
  ])
})

test('keeps every pasted image in order', () => {
  const rows = promptRows([
    { type: 'text', text: '[Image #1] [Image #2] compare these' },
    pasted('Zmlyc3Q='),
    pasted('c2Vjb25k'),
  ])
  assert.deepEqual(rows[0]?.shape === 'prose' ? rows[0].images : null, [
    'data:image/png;base64,Zmlyc3Q=',
    'data:image/png;base64,c2Vjb25k',
  ])
})

test('draws a prompt of images alone as a bubble with no words', () => {
  const rows = promptRows([{ type: 'text', text: '[Image #3]' }, pasted(PIXEL)])
  assert.deepEqual(rows, [
    {
      shape: 'prose',
      id: 'prompt-1:0',
      role: 'user',
      text: '',
      images: [`data:image/png;base64,${PIXEL}`],
    },
  ])
})

test('keeps an image placeholder the prompt carries no image for', () => {
  const rows = promptRows('What does [Image #1] mean?')
  assert.deepEqual(rows, [
    { shape: 'prose', id: 'prompt-1:0', role: 'user', text: 'What does [Image #1] mean?' },
  ])
})

test('draws attached image files from the @path mentions Argo appends', () => {
  const rows = promptRows('Review this.\n\n@/Users/x/shot#1.png @/Users/x/notes.md @/Users/x/b.JPG')
  assert.deepEqual(rows, [
    {
      shape: 'prose',
      id: 'prompt-1:0',
      role: 'user',
      text: 'Review this.\n\n@/Users/x/notes.md',
      images: ['file:///Users/x/shot%231.png', 'file:///Users/x/b.JPG'],
    },
  ])
})

for (const text of ['Compare @/Users/x/a.png with the design', 'Look at @/Users/x/a.png']) {
  test(`draws an image the person mentioned but keeps their words: ${text}`, () => {
    const rows = promptRows(text)
    assert.deepEqual(rows, [
      { shape: 'prose', id: 'prompt-1:0', role: 'user', text, images: ['file:///Users/x/a.png'] },
    ])
  })
}

test('draws an attached file whose path has a space, from its quoted mention', () => {
  const rows = promptRows('Look.\n\n@"/Users/x/Screenshot at 06.44.png" @/Users/x/notes.md')
  assert.deepEqual(rows, [
    {
      shape: 'prose',
      id: 'prompt-1:0',
      role: 'user',
      text: 'Look.\n\n@/Users/x/notes.md',
      images: ['file:///Users/x/Screenshot%20at%2006.44.png'],
    },
  ])
})

test('draws an image mentioned before a full stop, as Claude Code attaches it', () => {
  const rows = promptRows('Compare @/Users/x/a.png.')
  assert.deepEqual(rows[0]?.shape === 'prose' ? rows[0].images : null, ['file:///Users/x/a.png'])
})

test('keeps the words around a pasted placeholder as the person wrote them', () => {
  const rows = promptRows([{ type: 'text', text: '    indented\n[Image #2] see' }, pasted(PIXEL)])
  assert.equal(rows[0]?.shape === 'prose' ? rows[0].text : null, '    indented\nsee')
})

test('draws pasted images before attached files', () => {
  const rows = promptRows([
    pasted(PIXEL),
    { type: 'text', text: '[Image #1] fix\n\n@/Users/x/b.png' },
  ])
  assert.deepEqual(rows[0]?.shape === 'prose' ? rows[0] : null, {
    shape: 'prose',
    id: 'prompt-1:1',
    role: 'user',
    text: 'fix',
    images: [`data:image/png;base64,${PIXEL}`, 'file:///Users/x/b.png'],
  })
})

test('keeps an image the assistant sent as its source rather than dropping it', () => {
  const rows = promptRows([{ type: 'text', text: 'Here' }, pasted(PIXEL)], 'assistant')
  assert.deepEqual(
    rows.map((row) => [row.shape, 'images' in row]),
    [
      ['prose', false],
      ['source', false],
    ],
  )
})

test('never reads an image from what the assistant wrote', () => {
  const record = parseTranscriptLine(
    JSON.stringify({
      type: 'assistant',
      uuid: 'reply-1',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Saved @/Users/x/a.png' }] },
    }),
  )
  assert.deepEqual(record?.kind === 'message' ? record.blocks : null, [
    { shape: 'prose', text: 'Saved @/Users/x/a.png' },
  ])
})

test('keeps an image block that is not inline image bytes as its source', () => {
  const rows = promptRows([
    { type: 'text', text: 'Look' },
    { type: 'image', source: { type: 'url', url: 'https://example.com/a.png' } },
  ])
  assert.deepEqual(
    rows.map((row) => row.shape),
    ['prose', 'source'],
  )
})
