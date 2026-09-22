import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import { inputItemsFor } from '@/harnesses/codex/drive/input-items'

test('sends the draft alone when there are no attachments', () => {
  assert.deepEqual(inputItemsFor('Ship the composer.', []), [
    { type: 'text', text: 'Ship the composer.', text_elements: [] },
  ])
})

test('turns an image attachment into a localImage item after the draft', () => {
  const attachments: SessionAttachmentInput[] = [{ path: '/tmp/screenshot.png', kind: 'image' }]
  assert.deepEqual(inputItemsFor('Look at this.', attachments), [
    { type: 'text', text: 'Look at this.', text_elements: [] },
    { type: 'localImage', path: '/tmp/screenshot.png' },
  ])
})

const pathItem = (path: string) => ({
  type: 'text',
  text: path,
  text_elements: [{ byteRange: { start: 0, end: Buffer.byteLength(path) }, placeholder: path }],
})

test('turns a non-image attachment into a text item marking its path, not its contents', () => {
  const attachments: SessionAttachmentInput[] = [{ path: '/tmp/brief é.md', kind: 'file' }]
  assert.deepEqual(inputItemsFor('Review this.', attachments), [
    { type: 'text', text: 'Review this.', text_elements: [] },
    {
      type: 'text',
      text: '/tmp/brief é.md',
      text_elements: [{ byteRange: { start: 0, end: 16 }, placeholder: '/tmp/brief é.md' }],
    },
  ])
})

test('keeps every attachment as its own item, in the order they were chosen', () => {
  const attachments: SessionAttachmentInput[] = [
    { path: '/tmp/brief.md', kind: 'file' },
    { path: '/tmp/screenshot.png', kind: 'image' },
  ]
  assert.deepEqual(inputItemsFor('', attachments), [
    { type: 'text', text: '', text_elements: [] },
    pathItem('/tmp/brief.md'),
    { type: 'localImage', path: '/tmp/screenshot.png' },
  ])
})
