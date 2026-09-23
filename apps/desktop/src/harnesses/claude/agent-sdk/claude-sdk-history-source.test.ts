import { expect, test } from 'bun:test'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { managedRosterRow, type SessionFeedRow } from '@/domains/sessions/contract/model/models'
import { stitchChains } from '@/domains/sessions/contract/model/transcript/chains'
import { projectFeed } from '@/domains/sessions/main/projection/feed/feed-incremental'
import { readTranscriptFile } from '@/harnesses/claude/sessions/discovery/transcript-file'
import { createClaudeSdkHistorySource } from './claude-sdk-history-source'

function envelopeMessages(): SessionMessage[] {
  return [
    {
      type: 'user',
      uuid: 'command-spec',
      session_id: 'claude-envelope',
      message: {
        content:
          '<command-message>to-spec</command-message><command-name>/to-spec</command-name><command-args>https://github.com/milad-alizadeh/argo/issues/2669</command-args>',
      },
      parent_tool_use_id: null,
      parent_agent_id: null,
    },
    {
      type: 'user',
      uuid: 'command-tickets',
      session_id: 'claude-envelope',
      message: {
        content:
          '<command-message>to-tickets</command-message><command-name>/to-tickets</command-name><command-args></command-args>',
      },
      parent_tool_use_id: null,
      parent_agent_id: null,
    },
    {
      type: 'user',
      uuid: 'task-notification',
      session_id: 'claude-envelope',
      message: {
        content:
          '<task-notification><task-id>agent-9</task-id><tool-use-id>toolu_1</tool-use-id><status>completed</status><summary>Agent "Explore turn-setup and harness code for issue 2669" finished</summary><note>Done.</note><result>Found the cause.</result></task-notification>',
      },
      parent_tool_use_id: null,
      parent_agent_id: null,
    },
    {
      type: 'user',
      uuid: 'literal-tags',
      session_id: 'claude-envelope',
      message: { content: 'The literal <status>completed</status> tag is documented.' },
      parent_tool_use_id: null,
      parent_agent_id: null,
    },
  ]
}

function expectEnvelopesAreStructured(rows: SessionFeedRow[]) {
  expect(rows.some((row) => JSON.stringify(row).includes('<command-message>'))).toBe(false)
  expect(rows.some((row) => JSON.stringify(row).includes('<task-notification>'))).toBe(false)
  expect(rows).toContainEqual(
    expect.objectContaining({
      shape: 'event',
      text: '/to-spec https://github.com/milad-alizadeh/argo/issues/2669',
    }),
  )
  expect(rows).toContainEqual(expect.objectContaining({ shape: 'event', text: '/to-tickets' }))
  expect(
    rows.some((row) => JSON.stringify(row).includes('literal <status>completed</status> tag')),
  ).toBe(true)
}

test('adds a watched Claude SDK Session and its vendor history to the roster', async () => {
  const source = createClaudeSdkHistorySource({
    history: {
      listSessions: async () => [
        {
          sessionId: 'claude-1',
          summary: 'Review this change',
          firstPrompt: 'Review this change',
          lastModified: 2,
          createdAt: 1,
          cwd: '/repository',
        },
      ],
      getSessionMessages: async () => [
        {
          type: 'user',
          uuid: 'message-1',
          session_id: 'claude-1',
          message: { content: 'Review this change' },
          parent_tool_use_id: null,
          parent_agent_id: null,
        },
        {
          type: 'assistant',
          uuid: 'message-2',
          session_id: 'claude-1',
          message: { content: [{ type: 'text', text: 'SDK block reply' }] },
          parent_tool_use_id: null,
          parent_agent_id: null,
        },
      ],
    },
  })

  const listed = await source.discoverSessions()

  expect(source.managedSessions).toBeUndefined()
  expect(listed.rows).toMatchObject([
    { id: 'claude-1', harness: 'claude', posture: 'watched', cwd: '/repository' },
  ])
  const feed = await source.readObservedFeed?.('claude-1')
  expect(feed?.chainId).toBe('claude-1')
  expect(feed?.rows).toContainEqual({
    shape: 'prose',
    id: 'message-1:0',
    role: 'user',
    text: 'Review this change',
  })
  expect(feed?.rows).toContainEqual({
    shape: 'prose',
    id: 'message-2:0',
    role: 'assistant',
    text: 'SDK block reply',
  })
})

test('parses Claude SDK history envelopes before showing them in the Feed', async () => {
  const messages = envelopeMessages()
  const source = createClaudeSdkHistorySource({
    history: {
      listSessions: async () => [
        { sessionId: 'claude-envelope', summary: 'Envelope history', lastModified: 1 },
      ],
      getSessionMessages: async () => messages,
    },
  })

  await source.discoverSessions()
  const rows = (await source.readObservedFeed?.('claude-envelope'))?.rows ?? []

  expectEnvelopesAreStructured(rows)

  const transcript = readTranscriptFile('/transcript.jsonl', {
    sessionId: 'claude-envelope',
    lines: messages.map((message) => JSON.stringify(message)),
  })
  const chain = stitchChains([transcript])[0]
  const transcriptRows = chain === undefined ? [] : projectFeed(chain, undefined).rows

  expectEnvelopesAreStructured(transcriptRows)
})

test('lists Claude Sessions without waiting for their message histories', async () => {
  const source = createClaudeSdkHistorySource({
    history: {
      listSessions: async () => [
        { sessionId: 'claude-ready', summary: 'Ready now', lastModified: 1 },
      ],
      getSessionMessages: async () => await new Promise<never>(() => {}),
    },
  })

  const listed = await source.discoverSessions()

  expect(listed.rows.map((row) => row.id)).toEqual(['claude-ready'])
})

test('paginates watched Claude Sessions without merging them outside the source boundary', async () => {
  const source = createClaudeSdkHistorySource({
    history: {
      listSessions: async ({ offset }) =>
        offset === 0
          ? Array.from({ length: 50 }, (_, index) => ({
              sessionId: `claude-${index}`,
              summary: `Session ${index}`,
              lastModified: 100 - index,
            }))
          : [{ sessionId: 'claude-50', summary: 'Session 50', lastModified: 50 }],
      getSessionMessages: async () => [],
    },
  })

  const first = await source.discoverSessions({ cursor: null })
  const second = await source.discoverSessions({ cursor: first.nextCursor })

  expect(first.rows).toHaveLength(50)
  expect(first.nextCursor).toBe('50')
  expect(second.rows).toHaveLength(1)
  expect(second.nextCursor).toBeNull()
})

test('keeps a Session under its Project when Claude records a nested working directory', async () => {
  const source = createClaudeSdkHistorySource({
    history: {
      listSessions: async () => [
        {
          sessionId: 'claude-nested',
          summary: 'Nested directory',
          lastModified: 1,
          cwd: '/repository/packages/desktop',
        },
      ],
      getSessionMessages: async () => [],
    },
  })

  const listed = await source.discoverSessions({ projectRoot: '/repository' })

  expect(listed.rows.map((row) => row.id)).toEqual(['claude-nested'])
})

test('keeps watched history while a resumed Claude Session has a new managed native ID', async () => {
  const source = createClaudeSdkHistorySource({
    history: {
      listSessions: async () => [
        { sessionId: 'watched-id', summary: 'Old history', lastModified: 1 },
      ],
      getSessionMessages: async () => [],
    },
    managedSessions: () => [
      managedRosterRow({
        id: 'managed-id',
        session: {
          harness: 'claude',
          cwd: '/repository',
          prompt: 'Continue old history',
          setup: { model: null, effort: null, mode: null },
          startedAt: new Date(1).toISOString(),
          status: 'running',
          compactionPercentage: null,
          compactionStartedAt: null,
          compactionTokens: null,
          handoffFailure: null,
          handoffStartedAt: null,
        },
      }),
    ],
  })

  const listed = await source.discoverSessions()

  expect(listed.rows).toMatchObject([
    { id: 'watched-id', posture: 'watched' },
    { id: 'managed-id', posture: 'managed' },
  ])
})
