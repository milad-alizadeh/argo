import assert from 'node:assert/strict'
import { test } from 'node:test'
import { embedAttachments } from '../drive/attachment-prompt'
import { promptRows } from './prompt-fixture'

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

test('reads back every attachment the composer appends, as its bubble draws it', () => {
  const attachments = [
    { path: '/Users/x/Screenshot at 06.44.png', kind: 'image' as const },
    { path: '/Users/x/notes.md', kind: 'file' as const },
    { path: '/Users/x/b.png', kind: 'image' as const },
  ]
  const rows = promptRows(embedAttachments('Look.', attachments))
  assert.deepEqual(rows, [
    {
      shape: 'prose',
      id: 'prompt-1:0',
      role: 'user',
      text: 'Look.\n\n@/Users/x/notes.md',
      images: ['file:///Users/x/Screenshot%20at%2006.44.png', 'file:///Users/x/b.png'],
    },
  ])
})
