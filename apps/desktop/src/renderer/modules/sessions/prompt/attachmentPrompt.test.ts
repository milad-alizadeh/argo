import { describe, expect, test } from 'bun:test'
import { embedAttachments } from './attachmentPrompt'

describe('embedAttachments', () => {
  test('returns the draft unchanged when there are no attachments', () => {
    expect(embedAttachments('hello', [])).toBe('hello')
  })

  test('appends each path as an @-mention after the draft', () => {
    expect(embedAttachments('hello', ['/repo/a.md', '/repo/b.jpg'])).toBe(
      'hello\n\n@/repo/a.md @/repo/b.jpg',
    )
  })

  test('sends the mentions alone when the draft is empty', () => {
    expect(embedAttachments('', ['/repo/a.md'])).toBe('@/repo/a.md')
  })

  test('sends the mentions alone when the draft is only whitespace', () => {
    expect(embedAttachments('   ', ['/repo/a.md'])).toBe('@/repo/a.md')
  })
})
