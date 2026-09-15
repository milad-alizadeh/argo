import assert from 'node:assert/strict'
import { test } from 'node:test'
import { embedAttachments } from './attachment-prompt'

test('appends @path mentions after non-empty draft text, separated by a blank line', () => {
  assert.equal(
    embedAttachments('Review this.', [{ path: '/tmp/a.md', kind: 'file' }]),
    'Review this.\n\n@/tmp/a.md',
  )
})

test('joins multiple @path mentions with a space, in attachment order', () => {
  assert.equal(
    embedAttachments('', [
      { path: '/tmp/a.png', kind: 'image' },
      { path: '/tmp/b.md', kind: 'file' },
    ]),
    '@/tmp/a.png @/tmp/b.md',
  )
})

test('quotes a path with a space so Claude Code reads it whole', () => {
  assert.equal(
    embedAttachments('', [
      { path: '/Users/x/Screenshot 2026-09-15 at 06.44.50.png', kind: 'image' },
    ]),
    '@"/Users/x/Screenshot 2026-09-15 at 06.44.50.png"',
  )
})

test('returns the draft unchanged when there are no attachments', () => {
  assert.equal(embedAttachments('Review this.', []), 'Review this.')
})

test('sends the mentions alone when the draft is only whitespace', () => {
  assert.equal(embedAttachments('   ', [{ path: '/tmp/a.md', kind: 'file' }]), '@/tmp/a.md')
})
