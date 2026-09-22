import assert from 'node:assert/strict'
import { test } from 'node:test'
import { promptRows } from '@/harnesses/claude/sessions/prompt-fixture'
import { parseTranscriptLine } from '@/harnesses/claude/sessions/records'

const PIXEL = 'iVBORw0KGgo='

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

test('keeps the words around a pasted placeholder as the person wrote them', () => {
  const rows = promptRows([{ type: 'text', text: '    indented\nsee [Image #2]' }, pasted(PIXEL)])
  assert.equal(rows[0]?.shape === 'prose' ? rows[0].text : null, '    indented\nsee')
})

test('keeps a placeholder the sentence refers to', () => {
  const text = 'compare [Image #1] with [Image #2] please'
  const rows = promptRows([{ type: 'text', text }, pasted('Zmlyc3Q='), pasted('c2Vjb25k')])
  assert.equal(rows[0]?.shape === 'prose' ? rows[0].text : null, text)
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
    images: [`data:image/png;base64,${PIXEL}`, 'argo-attachment://local/Users/x/b.png'],
  })
})

test('keeps an image the assistant sent as its source rather than dropping it', () => {
  const rows = promptRows([{ type: 'text', text: 'Here' }, pasted(PIXEL)], 'assistant')
  assert.deepEqual(
    rows.map((row) => [row.shape, 'images' in row]),
    [
      ['prose', false],
      ['image', false],
    ],
  )
})

test('draws a prompt the person sent mid-turn, which the Harness writes as a queued attachment', () => {
  const record = parseTranscriptLine(
    JSON.stringify({
      type: 'attachment',
      uuid: 'queued-1',
      timestamp: '2026-09-18T20:37:45.436Z',
      attachment: {
        type: 'queued_command',
        commandMode: 'prompt',
        humanTurn: true,
        prompt: [{ type: 'text', text: '[Image #53] still no ticket number' }, pasted(PIXEL)],
      },
    }),
  )
  assert.equal(record?.kind, 'message')
  assert.deepEqual(record?.kind === 'message' ? [record.role, record.blocks] : null, [
    'user',
    [
      { shape: 'prose', text: 'still no ticket number' },
      { shape: 'image', url: `data:image/png;base64,${PIXEL}` },
    ],
  ])
})

test('hides a Subagent hand-back the harness queued as a prompt nobody typed', () => {
  const record = parseTranscriptLine(
    JSON.stringify({
      type: 'attachment',
      uuid: 'queued-2',
      timestamp: '2026-09-18T20:37:45.436Z',
      attachment: {
        type: 'queued_command',
        commandMode: 'prompt',
        prompt: '<agent-message from="agent-1">\n[Subagent hand-back] Done.\n</agent-message>',
      },
    }),
  )
  assert.notEqual(record?.kind, 'message')
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
