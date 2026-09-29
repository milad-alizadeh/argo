import { expect, test } from 'bun:test'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionLiveEvent } from '@/domains/sessions/api/session-live-event'
import { projectLiveFeedRows } from './live-feed-rows'

type Delegation = Extract<FeedContent, { kind: 'delegation' }>

function delegation(
  facts: Pick<Delegation, 'id' | 'event' | 'status'> & Partial<Delegation>,
): Delegation {
  return {
    kind: 'delegation',
    agentId: 'agent-7',
    prompt: null,
    model: null,
    name: null,
    summary: null,
    ...facts,
  }
}

function live(sequence: number, value: FeedContent): SessionLiveEvent {
  return {
    type: 'content',
    sessionId: '00000000-0000-4000-8000-000000000001',
    sequence,
    commandId: 'command-1',
    turnId: 'turn-1',
    vendorEventId: value.id,
    content: value,
  }
}

test('keeps each Subagent event as its own row in source order', () => {
  const rows = projectLiveFeedRows(
    [
      delegation({
        id: 'call-agent',
        event: 'started',
        status: 'running',
        name: 'Survey adapters',
        model: 'sonnet',
        prompt: 'Survey the adapters',
      }),
      delegation({
        id: 'call-agent:message-1',
        event: 'messaged',
        status: 'running',
        prompt: 'Also read the tests',
      }),
      delegation({
        id: 'call-agent:response',
        event: 'responded',
        status: 'completed',
        summary: 'Found two adapters',
      }),
    ],
    [],
  )
  const agent = {
    shape: 'subagent',
    subagentId: 'agent-7',
    name: 'Survey adapters',
    model: 'sonnet',
  } as const
  expect(rows).toEqual([
    { ...agent, id: 'call-agent', event: 'started', prompt: 'Survey the adapters' },
    { ...agent, id: 'call-agent:message-1', event: 'messaged', prompt: 'Also read the tests' },
    {
      ...agent,
      id: 'call-agent:response',
      event: 'responded',
      state: 'completed',
      text: 'Found two adapters',
    },
  ])
})

test('merges a live Subagent event with its history record once', () => {
  const started = delegation({
    id: 'call-agent',
    event: 'started',
    status: 'running',
    prompt: 'Survey the adapters',
    name: 'Survey adapters',
  })
  const response = delegation({ id: 'call-agent:response', event: 'responded', status: 'failed' })
  const rows = projectLiveFeedRows([started], [live(1, started), live(2, response)])
  expect(rows.map((row) => [row.id, row.shape === 'subagent' ? row.event : null])).toEqual([
    ['call-agent', 'started'],
    ['call-agent:response', 'responded'],
  ])
  expect(rows[1]).toMatchObject({ state: 'failed', name: 'Survey adapters' })
})
