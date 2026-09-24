import { expect, test } from 'bun:test'
import type { SDKSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import { createClaudeSdkHistorySource } from './claude-sdk-history-source'
import { managedClaudeSession } from './claude-sdk-history-test-fixtures'

test('routes a managed Claude Session rename through its adapter', async () => {
  const renameRequests: { sessionId: string; title: string }[] = []
  const source = createClaudeSdkHistorySource({
    managedSessions: () => [managedClaudeSession('native-session')],
    renameManagedSession: async (sessionId: string, title: string) => {
      renameRequests.push({ sessionId, title })
    },
  })
  if (source.rename === undefined) throw new Error('Claude Session rename is not connected.')

  const reply = await source.rename({
    version: 1,
    type: 'session.rename',
    requestId: 'rename-1',
    sessionId: 'native-session',
    name: 'Loud boundaries + close known silent-failure bugs',
  })

  expect(reply).toEqual({
    version: 1,
    type: 'session.renamed',
    requestId: 'rename-1',
    sessionId: 'native-session',
    title: 'Loud boundaries + close known silent-failure bugs',
  })
  expect(renameRequests).toEqual([
    {
      sessionId: 'native-session',
      title: 'Loud boundaries + close known silent-failure bugs',
    },
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
