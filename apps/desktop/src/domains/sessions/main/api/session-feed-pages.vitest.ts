import { expect, test } from 'vitest'
import { FEED_PAGE_ROWS } from '@/domains/sessions/api/feed'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import {
  command,
  content,
  historyReads,
  journal,
  message,
  observe,
  registerFeedDatabase,
  rowIds,
  sessionId,
} from '@/mocks/sessions/session-feed-harness'

registerFeedDatabase()

// `count` Turns of a prompt and a reply each, so every Turn is two rows.
function turns(count: number, from = 0): FeedContent[] {
  return Array.from({ length: count }, (_, index) => [
    message(`u${from + index}`, 'user', `Prompt ${from + index}`),
    message(`a${from + index}`, 'assistant', `Reply ${from + index}`),
  ]).flat()
}

const lastMessage = (feed: Awaited<ReturnType<typeof observe>>) => feed.messages.at(-1)

test('a Feed publishes its newest page first, and each older page only as rows put before it', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer(turns(250))

  expect(feed.latest()).toMatchObject({ state: 'ready', hasOlder: true })
  expect(rowIds(feed.latest())).toEqual(turns(100, 150).map(({ id }) => id))

  await expect(feed.caller.sessionFeedOlder({ sessionId })).resolves.toEqual({ accepted: true })
  expect(feed.latest()?.entries).toHaveLength(2 * FEED_PAGE_ROWS)
  expect(lastMessage(feed)).toMatchObject({ kept: FEED_PAGE_ROWS, tail: [] })
  expect(lastMessage(feed)).toHaveProperty('head', feed.latest()?.entries.slice(0, FEED_PAGE_ROWS))

  await feed.caller.sessionFeedOlder({ sessionId })
  expect(rowIds(feed.latest())).toEqual(turns(250).map(({ id }) => id))
  expect(feed.latest()?.hasOlder).toBe(false)
  await expect(feed.caller.sessionFeedOlder({ sessionId })).resolves.toEqual({ accepted: false })
  expect(history.pending).toHaveLength(0)
  feed.subscription.unsubscribe()
})

test('a cut-off read too short for a page reads wider, and starts at its first whole Turn', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  const cut = (count: number, from: number) => [
    message('cut', 'assistant', 'Cut'),
    ...turns(count, from),
  ]
  await history.answer(cut(50, 350), false)
  expect(history.pending.map(({ extent }) => extent)).toEqual([1])

  await history.answer(cut(300, 100), false)
  expect(feed.latest()).toMatchObject({ state: 'ready', hasOlder: true })
  expect(rowIds(feed.latest())).toEqual(turns(100, 300).map(({ id }) => id))

  // The rows already read hold two more pages, and the third reads further back.
  await feed.caller.sessionFeedOlder({ sessionId })
  await feed.caller.sessionFeedOlder({ sessionId })
  expect(history.pending).toHaveLength(0)
  expect(rowIds(feed.latest())?.[0]).toBe('u100')
  await feed.caller.sessionFeedOlder({ sessionId })
  expect(history.pending.map(({ extent }) => extent)).toEqual([1])
  await history.answer(cut(300, 100), false)
  expect(history.pending.map(({ extent }) => extent)).toEqual([2])
  await history.answer(turns(400))

  expect(rowIds(feed.latest())).toEqual(turns(400).map(({ id }) => id))
  expect(feed.latest()?.hasOlder).toBe(false)
  feed.subscription.unsubscribe()
})

test('a live row joins the end of a paged Feed, and the page keeps its first row', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer(turns(250))
  const first = rowIds(feed.latest())?.[0]

  journal.append(sessionId, content(command('live', 'bun test')))

  expect(rowIds(feed.latest())?.[0]).toBe(first)
  expect(lastMessage(feed)).toMatchObject({ head: [], kept: FEED_PAGE_ROWS })
  feed.subscription.unsubscribe()
})

test('an older page asked for while a read is running is read once that read ends', async () => {
  const history = historyReads()
  const feed = await observe({ readHistory: history.readHistory })
  await history.answer(turns(100, 300), false)
  expect(rowIds(feed.latest())).toEqual(turns(100, 300).map(({ id }) => id))

  await feed.caller.sessionFeedRefresh({ sessionId })
  await feed.caller.sessionFeedOlder({ sessionId })
  await history.answer(turns(100, 300), false)

  expect(history.pending.map(({ extent }) => extent)).toEqual([1])
  await history.answer(turns(400))
  expect(rowIds(feed.latest())?.[0]).toBe('u200')
  feed.subscription.unsubscribe()
})
