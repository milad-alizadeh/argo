import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { SessionAttachmentInput } from '../../../core/sessions/attachments-contract'
import { inputItemsFor } from './input-items'

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

test('turns a non-image attachment into a text item holding its path, not its contents', () => {
  const attachments: SessionAttachmentInput[] = [{ path: '/tmp/brief.md', kind: 'file' }]
  assert.deepEqual(inputItemsFor('Review this.', attachments), [
    { type: 'text', text: 'Review this.', text_elements: [] },
    { type: 'text', text: '/tmp/brief.md', text_elements: [] },
  ])
})

test('keeps every attachment as its own item, in the order they were chosen', () => {
  const attachments: SessionAttachmentInput[] = [
    { path: '/tmp/brief.md', kind: 'file' },
    { path: '/tmp/screenshot.png', kind: 'image' },
  ]
  assert.deepEqual(inputItemsFor('', attachments), [
    { type: 'text', text: '', text_elements: [] },
    { type: 'text', text: '/tmp/brief.md', text_elements: [] },
    { type: 'localImage', path: '/tmp/screenshot.png' },
  ])
})
