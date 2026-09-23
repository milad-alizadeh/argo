import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { SDKSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import { managedRosterRow } from '@/domains/sessions/contract/model/models'
import { createClaudeSdkHistorySource } from './claude-sdk-history-source'

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
    id: 'message-1',
    role: 'user',
    text: 'Review this change',
  })
  expect(feed?.rows).toContainEqual({
    shape: 'prose',
    id: 'message-2',
    role: 'assistant',
    text: 'SDK block reply',
  })
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

test('counts only the current SDK pass and does not mark later pages unreadable', async () => {
  const records = Array.from({ length: 200 }, (_, index) => ({
    sessionId: `claude-${index}`,
    summary: `Session ${index}`,
    lastModified: 200 - index,
  }))
  const source = createClaudeSdkHistorySource({
    countTranscriptFiles: async () => records.length,
    history: {
      listSessions: async ({ offset }) => records.slice(offset, offset + 50),
      getSessionMessages: async () => [],
    },
  })

  const first = await source.discoverSessions({ cursor: null })

  expect(first.filesFound).toBe(200)
  expect(first.filesRead).toBe(50)
  expect(first.filesUnreadable).toBe(0)
  expect(first.filesParsed).toBe(50)
  expect(first.historyComplete).toBe(false)

  let page = first
  while (page.nextCursor !== null) {
    page = await source.discoverSessions({ cursor: page.nextCursor })
  }

  expect(page.filesFound).toBe(200)
  expect(page.filesRead).toBe(200)
  expect(page.filesUnreadable).toBe(0)
  expect(page.filesParsed).toBe(200)
  expect(page.historyComplete).toBe(true)
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

test('reports and filters Claude SDK records with invalid roster data', async () => {
  const records = [
    { sessionId: 'untitled', summary: '', lastModified: 1 },
    { sessionId: 'missing-time', summary: 'Missing time', createdAt: null, lastModified: null },
    {
      sessionId: 'relay-output',
      summary: 'Relay',
      firstPrompt: 'AGENT OUTPUT: generated',
      lastModified: 1,
    },
    { sessionId: 'valid', summary: 'Known Session', lastModified: 1 },
  ] as unknown as SDKSessionInfo[]
  const source = createClaudeSdkHistorySource({
    history: {
      listSessions: async () => records,
      getSessionMessages: async () => [],
    },
  })

  const listed = await source.discoverSessions()

  expect(listed.rows.map((row) => row.id)).toEqual(['untitled', 'valid'])
  expect(listed.filesFound).toBe(4)
  expect(listed.filesRead).toBe(4)
  expect(listed.filesUnreadable).toBe(2)
  expect(listed.filesParsed).toBe(1)
})

test('reports transcript records omitted by the Claude SDK', async () => {
  const transcriptsRoot = await mkdtemp(path.join(os.tmpdir(), 'argo-claude-roster-'))
  const projectDirectory = path.join(transcriptsRoot, 'repository')
  await mkdir(projectDirectory)
  await writeFile(path.join(projectDirectory, 'sdk-session.jsonl'), '')
  await writeFile(path.join(projectDirectory, 'omitted-session.jsonl'), '')
  try {
    const source = createClaudeSdkHistorySource({
      countTranscriptFiles: async () => 2,
      history: {
        listSessions: async () => [
          { sessionId: 'sdk-session', summary: 'Visible Session', lastModified: 1 },
        ],
        getSessionMessages: async () => [],
      },
    })

    const listed = await source.discoverSessions()

    expect(listed.filesFound).toBe(2)
    expect(listed.filesRead).toBe(1)
    expect(listed.filesUnreadable).toBe(1)
    expect(listed.filesParsed).toBe(1)
    expect(listed.historyComplete).toBe(false)
  } finally {
    await rm(transcriptsRoot, { recursive: true, force: true })
  }
})

test('compares transcript omissions with the current SDK pass, not cached history', async () => {
  let sdkRecords = [{ sessionId: 'stale-session', summary: 'Session title', lastModified: 1 }]
  const source = createClaudeSdkHistorySource({
    countTranscriptFiles: async () => 1,
    history: {
      listSessions: async () => sdkRecords,
      getSessionMessages: async () => [],
    },
  })

  const first = await source.discoverSessions()
  sdkRecords = []
  const second = await source.discoverSessions()

  expect(first.historyComplete).toBe(true)
  expect(second.filesFound).toBe(1)
  expect(second.filesRead).toBe(0)
  expect(second.filesUnreadable).toBe(1)
  expect(second.filesParsed).toBe(0)
  expect(second.historyComplete).toBe(false)
  expect(await source.readObservedFeed?.('stale-session')).not.toBeNull()
})
