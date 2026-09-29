import { expect, test } from 'bun:test'
import { feedSubagents, hasSubagentTranscript } from './feed-subagents'

test('keeps the nickname a start gave a Subagent through its later events', () => {
  expect(
    feedSubagents([
      {
        shape: 'subagent',
        id: 'spawn',
        subagentId: 'thread-child',
        event: 'started',
        name: 'spec_review',
        nickname: 'Jason',
      },
      {
        shape: 'subagent',
        id: 'done',
        subagentId: 'thread-child',
        event: 'responded',
        state: 'completed',
        name: 'spec_review',
      },
    ]),
  ).toEqual([{ id: 'thread-child', label: 'spec_review', nickname: 'Jason', state: 'completed' }])
})

test('reads a Subagent Feed of only its own completion as having no transcript', () => {
  const completion = {
    shape: 'subagent',
    id: 'done',
    subagentId: 'thread-child',
    event: 'responded',
    state: 'completed',
  } as const
  expect(hasSubagentTranscript([completion], 'thread-child')).toBe(false)
  expect(
    hasSubagentTranscript(
      [{ shape: 'prose', id: 'brief', role: 'user', text: 'Go' }, completion],
      'thread-child',
    ),
  ).toBe(true)
})
