import { expect, test } from 'bun:test'
import { feedSubagents } from './feed-subagents'

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
