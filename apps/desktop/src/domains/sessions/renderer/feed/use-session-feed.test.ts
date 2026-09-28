import { expect, test } from 'bun:test'
import type { FeedContent } from '@/domains/sessions/api/feed-content'
import type { SessionFeedSnapshot } from '../types'
import { displayedFeed } from './use-session-feed'

function snapshot(sessionId: string, chainId: string): SessionFeedSnapshot {
  return {
    version: 1,
    type: 'session.feed.read',
    requestId: `${chainId}-read`,
    sessionId,
    chainId,
    revision: chainId,
    content: [{ kind: 'message', id: `${chainId}-reply`, role: 'assistant', text: chainId }],
  }
}

test('a late snapshot for another Session is not shown', () => {
  expect(
    displayedFeed({
      selectedSessionId: 'session-b',
      subagentId: null,
      reading: snapshot('session-a', 'session-a'),
      live: null,
    }),
  ).toBeNull()
})

test('a late snapshot for another subagent chain of the same Session is not shown', () => {
  expect(
    displayedFeed({
      selectedSessionId: 'session-a',
      subagentId: 'child-2',
      reading: snapshot('session-a', 'child-1'),
      live: null,
    }),
  ).toBeNull()
})

test('the selected chain snapshot is shown as rows', () => {
  const feed = displayedFeed({
    selectedSessionId: 'session-a',
    subagentId: 'child-1',
    reading: snapshot('session-a', 'child-1'),
    live: null,
  })
  expect(feed?.rows.map((row) => row.id)).toEqual(['child-1-reply'])
})

const firstTool: FeedContent = {
  kind: 'tool',
  id: 'use-1',
  callId: 'call-1',
  name: 'Bash',
  status: 'running',
  input: { command: 'bun test' },
  output: null,
  summary: null,
  presentation: { kind: 'command', label: 'Run the Feed tests', agentDescription: true },
}
const secondTool: FeedContent = {
  kind: 'tool',
  id: 'use-2',
  callId: 'call-2',
  name: 'Read',
  status: 'running',
  input: { file_path: '/repo/feed.ts' },
  output: null,
  summary: null,
  presentation: { kind: 'read', label: 'Read feed.ts' },
}
test('Claude content keeps descriptions and one stable collapsible run through a history refresh', () => {
  const reading = { ...snapshot('session-a', 'session-a'), content: [firstTool, secondTool] }
  const before = displayedFeed({
    selectedSessionId: 'session-a',
    subagentId: null,
    reading,
    live: null,
  })
  const after = displayedFeed({
    selectedSessionId: 'session-a',
    subagentId: null,
    reading: {
      ...reading,
      revision: 'refresh',
      content: [
        firstTool,
        secondTool,
        {
          ...firstTool,
          id: 'result-1',
          status: 'completed' as const,
          input: null,
          presentation: undefined,
          output: [{ kind: 'text' as const, text: '20 pass' }],
        },
      ],
    },
    live: null,
  })
  expect(before?.rows).toMatchObject([
    {
      shape: 'tool-group',
      calls: [
        { id: 'call-1', kind: 'command', label: 'Run the Feed tests' },
        { id: 'call-2', kind: 'read', label: 'Read feed.ts' },
      ],
    },
  ])
  expect(after?.rows).toHaveLength(1)
  expect(after?.rows[0]?.id).toBe(before?.rows[0]?.id)
  expect(after?.rows).toMatchObject([
    {
      calls: [
        { id: 'call-1', status: 'succeeded', evidence: { source: '20 pass' } },
        { id: 'call-2', status: 'running' },
      ],
    },
  ])
})
