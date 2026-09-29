import { expect, test } from 'bun:test'
import {
  applyFeedReadingChange,
  type FeedReading,
  feedReading,
  feedReadingChange,
} from './feed-reading'
import { projectFeedRowEntries } from './feed-row-entries'

const sessionId = '00000000-0000-4000-8000-000000000001'

function reading(texts: string[], state: FeedReading['state'] = 'ready'): FeedReading {
  const history = texts.map((text, index) => ({
    kind: 'message',
    id: `m${index}`,
    role: 'assistant',
    text,
  }))
  return feedReading({
    sessionId,
    chainId: sessionId,
    state,
    error: null,
    pendingPermissionId: null,
    liveStatus: null,
    entries: projectFeedRowEntries({ history, live: [] }).entries,
    subagents: [],
  })
}

test('a later reading sends only the entries after those it shares with the one before', () => {
  const before = reading(['One', 'Two', 'Three'])
  const after = reading(['One', 'Two', 'Three, and more', 'Four'])
  const change = feedReadingChange(before, after)
  expect(change).toMatchObject({ baseRevision: before.revision, kept: 2 })
  expect(change.tail).toEqual(after.entries.slice(2))
  expect(applyFeedReadingChange(before, change)).toEqual(after)
})

test('a change keeps the unchanged entries the reader already holds', () => {
  const before = reading(['One', 'Two'])
  const applied = applyFeedReadingChange(
    before,
    feedReadingChange(before, reading(['One', 'Three'])),
  )
  expect(applied?.entries[0]).toBe(before.entries[0] as FeedReading['entries'][number])
})

test('a change to envelope facts alone carries them with no entries', () => {
  const before = reading(['One'], 'loading')
  const after = reading(['One'], 'ready')
  const change = feedReadingChange(before, after)
  expect(change.tail).toEqual([])
  expect(applyFeedReadingChange(before, change)).toEqual(after)
})

test('a change is refused by a reader that holds a different reading', () => {
  const before = reading(['One'])
  const change = feedReadingChange(before, reading(['One', 'Two']))
  expect(applyFeedReadingChange(undefined, change)).toBeNull()
  expect(applyFeedReadingChange(reading(['Other']), change)).toBeNull()
})
