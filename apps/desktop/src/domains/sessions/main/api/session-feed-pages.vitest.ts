import { expect, test } from 'vitest'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import { SessionFeedPages } from './session-feed-pages'

function messages(count: number): FeedContent[] {
  return Array.from({ length: count }, (_, index) => ({
    kind: 'message',
    id: `message-${index}`,
    role: 'assistant',
    text: `Reply ${index}`,
  }))
}

test('opens at the newest page and reads older pages without another vendor read', async () => {
  const pages = new SessionFeedPages()
  const saved = messages(120)
  let reads = 0
  const readHistory = async () => {
    reads += 1
    return saved
  }
  const target = { sessionId: 'session-1', chainId: 'session-1', readHistory }
  const latest = await pages.read({ ...target, before: null })
  expect(latest.content.map((item) => item.id)).toEqual(
    Array.from({ length: 50 }, (_, index) => `message-${index + 70}`),
  )
  expect(latest.olderCursor).not.toBeNull()
  const middle = await pages.read({ ...target, before: latest.olderCursor })
  expect(middle.content[0]?.id).toBe('message-20')
  const oldest = await pages.read({ ...target, before: middle.olderCursor })
  expect(oldest.content).toHaveLength(20)
  expect(oldest.olderCursor).toBeNull()
  expect(reads).toBe(1)
})

test('a fresh latest read replaces the memory cache and includes new vendor history', async () => {
  const pages = new SessionFeedPages()
  let saved = messages(51)
  const target = {
    sessionId: 'session-1',
    chainId: 'session-1',
    readHistory: async () => saved,
  }
  const first = await pages.read({ ...target, before: null })
  expect(first.content.at(-1)?.id).toBe('message-50')
  saved = messages(52)
  const next = await pages.read({ ...target, before: null })
  expect(next.content.at(-1)?.id).toBe('message-51')
})

test('an older cursor belongs to one Session chain', async () => {
  const pages = new SessionFeedPages()
  const target = {
    sessionId: 'session-1',
    chainId: 'session-1',
    readHistory: async () => messages(51),
  }
  const first = await pages.read({ ...target, before: null })
  await expect(
    pages.read({ ...target, chainId: 'child-1', before: first.olderCursor }),
  ).rejects.toThrow('invalid-feed-cursor')
})
