import { expect, test } from 'bun:test'
import { feedRowLabels } from '@/mocks/sessions/feed-row-labels'
import { liveContent, liveStatus } from '@/mocks/sessions/live-events.fixture'
import type { FeedContent } from '../feed-content'
import type { SessionLiveEvent } from '../session-live-event'
import { projectLiveFeedRows } from './live-feed-rows'

test('updates one status row by vendor identity', () => {
  const running = { ...liveStatus(1, 'running'), vendorEventId: 'item-1' }
  const idle = { ...liveStatus(2, 'idle'), vendorEventId: 'item-1' }
  const prompt = liveContent(0, { id: 'prompt-1', kind: 'message', role: 'user', text: 'Go' })
  expect(projectLiveFeedRows([], [prompt, running, idle])).toMatchObject([
    { id: 'prompt-1' },
    { id: 'status:item-1', text: 'idle' },
  ])
})

function drawn(events: SessionLiveEvent[]) {
  return feedRowLabels(projectLiveFeedRows([], events))
}

test('draws a Turn prompt before the Turn status its Harness reported first', () => {
  const prompt: FeedContent = { id: 'prompt-1', kind: 'message', role: 'user', text: 'Go' }
  const reply: FeedContent = { id: 'reply-1', kind: 'message', role: 'assistant', text: 'Done' }
  const promptFirst = [
    liveContent(1, prompt),
    liveStatus(2, 'running'),
    liveContent(3, reply),
    liveStatus(4, 'idle'),
  ]
  const statusFirst = [
    liveStatus(1, 'running'),
    liveContent(2, prompt),
    liveContent(3, reply),
    liveStatus(4, 'idle'),
  ]
  expect(drawn(statusFirst)).toEqual(['user', 'running', 'assistant', 'idle'])
  expect(drawn(statusFirst)).toEqual(drawn(promptFirst))
})

test('holds a Turn status back until its prompt arrives', () => {
  const firstTurn = [
    liveContent(1, { id: 'prompt-1', kind: 'message', role: 'user', text: 'Go' }),
    liveStatus(2, 'running'),
    liveContent(3, { id: 'reply-1', kind: 'message', role: 'assistant', text: 'Done' }),
    liveStatus(4, 'idle'),
  ]
  const beforeEcho = [...firstTurn, liveStatus(5, 'running', 'command-2')]
  const secondPrompt = liveContent(
    6,
    { id: 'prompt-2', kind: 'message', role: 'user', text: 'Again' },
    'command-2',
  )
  expect(drawn(beforeEcho)).toEqual(['user', 'running', 'assistant', 'idle'])
  expect(drawn([...beforeEcho, secondPrompt])).toEqual([
    'user',
    'running',
    'assistant',
    'idle',
    'user',
    'running',
  ])
})

test('draws a held Turn status after every row its prompt drew', () => {
  const reference: FeedContent = {
    id: 'item-1:skill:0',
    kind: 'reference',
    referenceType: 'skill',
    label: 'review',
    target: '/repo/.agents/skills/review/SKILL.md',
    text: null,
  }
  const prompt: FeedContent = { id: 'item-1', kind: 'message', role: 'user', text: 'Review' }
  const promptEvent = (sequence: number, value: FeedContent) => ({
    ...liveContent(sequence, value),
    vendorEventId: 'item-1',
  })
  const ids = (events: SessionLiveEvent[]) => projectLiveFeedRows([], events).map((row) => row.id)
  expect(ids([liveStatus(1, 'running'), promptEvent(2, reference)])).toEqual([
    'item-1:skill:0',
    'status:1',
  ])
  expect(
    ids([liveStatus(1, 'running'), promptEvent(2, reference), promptEvent(3, prompt)]),
  ).toEqual(['item-1:skill:0', 'item-1', 'status:1'])
})

test('keeps a Turn status above a later user row of the same command', () => {
  const interrupted: FeedContent = {
    id: 'interrupt-1',
    kind: 'message',
    role: 'user',
    text: '[Request interrupted by user]',
  }
  const rows = projectLiveFeedRows(
    [],
    [
      liveContent(1, { id: 'prompt-1', kind: 'message', role: 'user', text: 'Go' }),
      liveStatus(2, 'running'),
      liveContent(3, { id: 'reply-1', kind: 'message', role: 'assistant', text: 'Partial' }),
      liveContent(4, interrupted),
      liveStatus(5, 'idle'),
    ],
  )
  expect(feedRowLabels(rows)).toEqual(['user', 'running', 'assistant', 'user', 'idle'])
})
