import { expect, test } from 'bun:test'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import type { HistoryChange } from '@/harnesses/registration'
import { SessionEventJournal } from './session-event-journal'
import { SessionHistoryFollowers } from './session-history-followers'

const sessionId = '00000000-0000-4000-8000-000000000001'
const root = { nativeId: 'native-1', subagentId: null, cwd: null }
const appended: HistoryChange = {
  type: 'appended',
  events: [
    {
      type: 'content',
      commandId: null,
      turnId: null,
      vendorEventId: 'line-1',
      content: { kind: 'message', id: 'line-1', role: 'assistant', text: 'From the terminal.' },
    },
  ],
}

function setup(live = false) {
  const journal = new SessionEventJournal()
  const tails: { changed: (change: HistoryChange) => void; stopped: boolean }[] = []
  const followers = new SessionHistoryFollowers(
    journal,
    (_harness, _target, changed) => {
      const tail = { changed, stopped: false }
      tails.push(tail)
      return () => {
        tail.stopped = true
      }
    },
    () => live,
  )
  const events: SessionLiveEvent[] = []
  journal.subscribe(sessionId, (event) => events.push(event))
  return { followers, tails, events }
}

test('appends an external Session’s new history lines to its journal', () => {
  const { followers, tails, events } = setup()
  followers.follow({ sessionId, harness: 'claude', target: root }, () => {
    throw new Error('An append must not invalidate the Feed.')
  })

  tails[0]?.changed(appended)

  expect(events).toMatchObject([
    { sessionId, sequence: 1, type: 'content', vendorEventId: 'line-1' },
  ])
})

test('shares one tail between readers and stops it after the last one leaves', () => {
  const { followers, tails } = setup()
  const invalidated: string[] = []
  const first = followers.follow({ sessionId, harness: 'claude', target: root }, () =>
    invalidated.push('first'),
  )
  const second = followers.follow({ sessionId, harness: 'claude', target: root }, () =>
    invalidated.push('second'),
  )

  tails[0]?.changed({ type: 'rewritten' })
  first()
  expect(tails[0]?.stopped).toBe(false)
  second()

  expect(tails).toHaveLength(1)
  expect(tails[0]?.stopped).toBe(true)
  expect(invalidated).toEqual(['first', 'second'])
})

test('leaves appended lines to a live channel that carries them already', () => {
  const { followers, tails, events } = setup(true)
  followers.follow({ sessionId, harness: 'claude', target: root }, () => {})

  tails[0]?.changed(appended)

  expect(events).toEqual([])
})

test('reads a Subagent’s history again whole on any change', () => {
  const { followers, tails, events } = setup()
  let invalidated = 0
  followers.follow(
    { sessionId, harness: 'claude', target: { ...root, subagentId: 'agent-1' } },
    () => {
      invalidated += 1
    },
  )

  tails[0]?.changed(appended)

  expect(invalidated).toBe(1)
  expect(events).toEqual([])
})
