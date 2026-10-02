import { expect, test } from 'bun:test'
import { liveContent } from '@/mocks/sessions/live-events.fixture'
import { SESSION_LIVE_REPLAY_BYTE_LIMIT, type SessionLiveEvent } from '../session-live-event'
import { emptyLiveEventBuffer, retainLiveEvent } from './live-event-buffer'
import { projectLiveFeedRows } from './live-feed-rows'

const sessionId = '00000000-0000-4000-8000-000000000001'

function textEvent(sequence: number, id: string, text: string): SessionLiveEvent {
  return {
    type: 'content',
    sessionId,
    sequence,
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: id,
    content: { kind: 'message', id, role: 'assistant', text },
  }
}

test('keeps the first and latest text snapshots in their Feed position', () => {
  const running: SessionLiveEvent = {
    type: 'status',
    sessionId,
    sequence: 2,
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: null,
    status: 'running',
  }
  const prompt = liveContent(0, { kind: 'message', id: 'prompt-1', role: 'user', text: 'Read' })
  const events = [
    prompt,
    textEvent(1, 'reply-1', 'R'),
    running,
    textEvent(3, 'reply-1', 'Re'),
    textEvent(4, 'reply-1', 'Reading'),
  ]
  const retained = events.reduce(retainLiveEvent, emptyLiveEventBuffer())
  expect(retained.events.map((event) => event.sequence)).toEqual([0, 1, 2, 4])
  expect(projectLiveFeedRows([], retained.events).map((row) => row.id)).toEqual([
    'prompt-1',
    'reply-1',
    'status:2',
  ])
  expect(projectLiveFeedRows([], retained.events)[1]).toMatchObject({ text: 'Reading' })
})

test('drops older content before repeated snapshots exceed the browser byte budget', () => {
  const largeText = 'x'.repeat(SESSION_LIVE_REPLAY_BYTE_LIMIT / 2)
  const first = retainLiveEvent(null, textEvent(1, 'reply-1', largeText))
  const retained = retainLiveEvent(first, textEvent(2, 'reply-2', largeText))
  expect(retained.events.map((event) => event.sequence)).toEqual([2])
  expect(retained.eventBytes).toBeLessThanOrEqual(SESSION_LIVE_REPLAY_BYTE_LIMIT)
})

test('does not retain a single event larger than the browser byte budget', () => {
  const retained = retainLiveEvent(
    null,
    textEvent(1, 'reply-1', 'x'.repeat(SESSION_LIVE_REPLAY_BYTE_LIMIT)),
  )
  expect(retained.events).toEqual([])
  expect(retained.eventBytes).toBe(0)
})
