import { expect, test } from 'bun:test'
import { createLiveMessages } from '@/harnesses/claude/drive/live-messages'

// The fields of a MessageDisplay hook input claude 2.1.270 sends, one batch of lines per call.
const batch = (turn: string) => (message: string, index: number, delta: string) => ({
  session_id: 'claude-session',
  hook_event_name: 'MessageDisplay',
  turn_id: turn,
  message_id: message,
  index,
  final: false,
  delta,
})

test('holds each message of the running Turn, batch by batch, in the order Claude wrote them', () => {
  const live = createLiveMessages()
  live.record(batch('turn-1')('ducks', 0, 'Ducks glide.\n'))
  live.record(batch('turn-1')('ducks', 1, 'They dabble.\n'))
  live.record(batch('turn-1')('ducks', 2, 'Let me read it.'))
  live.record(batch('turn-1')('geese', 0, 'Geese honk.\n'))

  expect(live.list()).toEqual([
    { id: 'ducks', text: 'Ducks glide.\nThey dabble.\nLet me read it.' },
    { id: 'geese', text: 'Geese honk.\n' },
  ])
})

test('a new Turn replaces what the last Turn streamed', () => {
  const live = createLiveMessages()
  live.record(batch('turn-1')('ducks', 0, 'Ducks glide.'))
  live.record(batch('turn-2')('geese', 0, 'Geese honk.\n'))

  expect(live.list()).toEqual([{ id: 'geese', text: 'Geese honk.\n' }])
})

test('joins batches in index order and stops at one that has not arrived', () => {
  const live = createLiveMessages()
  live.record(batch('turn-1')('ducks', 2, 'Third.\n'))
  live.record(batch('turn-1')('ducks', 0, 'First.\n'))
  expect(live.list()).toEqual([{ id: 'ducks', text: 'First.\n' }])

  live.record(batch('turn-1')('ducks', 1, 'Second.\n'))
  expect(live.list()).toEqual([{ id: 'ducks', text: 'First.\nSecond.\nThird.\n' }])
})

test('once Argo sends the next Turn, drops the last Turn and ignores its late batches', () => {
  const live = createLiveMessages()
  live.record(batch('turn-1')('ducks', 0, 'Ducks glide.\n'))

  live.retire()
  live.record(batch('turn-1')('ducks', 1, 'They dabble.\n'))
  expect(live.list()).toEqual([])

  live.record(batch('turn-2')('geese', 0, 'Geese honk.\n'))
  expect(live.list()).toEqual([{ id: 'geese', text: 'Geese honk.\n' }])
})

test('ignores a batch that is not a MessageDisplay input', () => {
  const live = createLiveMessages()
  live.record({ turn_id: 'turn-1', message_id: 'ducks', index: 'first', delta: 'Ducks.' })
  live.record('Ducks glide.')

  expect(live.list()).toEqual([])
})
