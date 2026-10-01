import { expect, mock, test } from 'bun:test'
import type { SDKSessionInfo } from '@anthropic-ai/claude-agent-sdk'
import { getClaudeSessionSummary, listClaudeSessionSummaries } from './claude-session-discovery'

const ID_ONE = '00000000-0000-4000-8000-000000000001'
const ID_TWO = '00000000-0000-4000-8000-000000000002'

test('returns generic Session records and counts malformed Claude metadata', async () => {
  const requested: string[] = []
  const result = await listClaudeSessionSummaries({
    knownNativeIds: [ID_ONE],
    reader: {
      list: async () => [{ sessionId: 'invalid', summary: 'Bad', lastModified: 1 }],
      listSubagents: async () => [],
      get: async (nativeId) => {
        requested.push(nativeId)
        return { sessionId: ID_ONE, summary: 'Known Session', lastModified: 2 }
      },
    },
  })
  expect(requested).toEqual([ID_ONE])
  expect(result).toEqual({
    records: [{ nativeId: ID_ONE, preview: 'Known Session', activityAt: 2 }],
    skipped: 1,
  })
})

test('reads interactive Sessions and gets metadata for known Argo Sessions', async () => {
  const requested: string[] = []
  const result = await listClaudeSessionSummaries({
    knownNativeIds: [ID_ONE, ID_TWO],
    reader: {
      list: async () => [
        { sessionId: ID_ONE, summary: 'External Session', lastModified: 1, cwd: '/repo' },
        { sessionId: 'not-a-uuid', summary: 'Bad', lastModified: 1 },
      ],
      get: async (nativeId) => {
        requested.push(nativeId)
        return nativeId === ID_TWO
          ? { sessionId: ID_TWO, summary: 'Argo Session', lastModified: 2, customTitle: 'Pinned' }
          : undefined
      },
      listSubagents: async () => [],
    },
  })
  expect(requested).toEqual([ID_TWO])
  expect(result).toEqual({
    records: [
      { nativeId: ID_ONE, activityAt: 1, preview: 'External Session', cwd: '/repo' },
      { nativeId: ID_TWO, activityAt: 2, customTitle: 'Pinned', preview: 'Argo Session' },
    ],
    skipped: 1,
  })
})

test('leaves out a custom title Claude does not report', async () => {
  const result = await listClaudeSessionSummaries({
    knownNativeIds: [],
    reader: {
      list: async () => [
        { sessionId: ID_ONE, summary: 'Sparse Session', lastModified: 1, customTitle: undefined },
      ],
      get: async () => undefined,
      listSubagents: async () => [],
    },
  })
  expect(result.records[0]).not.toHaveProperty('customTitle')
})

test('counts a Session whose custom title breaks the SDKSessionInfo type', async () => {
  const outsideType = { sessionId: ID_ONE, summary: 'Cleared', lastModified: 1, customTitle: null }
  const result = await listClaudeSessionSummaries({
    knownNativeIds: [],
    reader: {
      list: async () => [outsideType as unknown as SDKSessionInfo],
      get: async () => undefined,
      listSubagents: async () => [],
    },
  })
  expect(result).toEqual({ records: [], skipped: 1 })
})

test('indexes Claude child IDs without reading their messages', async () => {
  const requested: Array<{ sessionId: string; cwd: string | null }> = []
  const result = await listClaudeSessionSummaries({
    knownNativeIds: [],
    reader: {
      list: async () => [{ sessionId: ID_ONE, summary: 'Parent', lastModified: 1, cwd: '/repo' }],
      get: async () => undefined,
      listSubagents: async (sessionId, cwd) => {
        requested.push({ sessionId, cwd })
        return ['agent-a', 'agent-b', 'invalid child id']
      },
    },
  })
  expect(requested).toEqual([{ sessionId: ID_ONE, cwd: '/repo' }])
  expect(result).toEqual({
    records: [{ nativeId: ID_ONE, preview: 'Parent', activityAt: 1, cwd: '/repo' }],
    subagents: [
      { nativeId: 'agent-a', parentNativeId: ID_ONE },
      { nativeId: 'agent-b', parentNativeId: ID_ONE },
    ],
    skipped: 1,
  })
})

test('a failed child-ID scan does not hide another Claude Session', async () => {
  const warn = mock(() => {})
  const before = console.warn
  console.warn = warn
  try {
    const result = await listClaudeSessionSummaries({
      knownNativeIds: [],
      reader: {
        list: async () => [
          { sessionId: ID_ONE, summary: 'First', lastModified: 1 },
          { sessionId: ID_TWO, summary: 'Second', lastModified: 2 },
        ],
        get: async () => undefined,
        listSubagents: async (sessionId) => {
          if (sessionId === ID_ONE) throw new Error('Unreadable directory')
          return ['agent-two']
        },
      },
    })
    expect(result.records).toHaveLength(2)
    expect(result.subagents).toEqual([{ nativeId: 'agent-two', parentNativeId: ID_TWO }])
    expect(result.skipped).toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)
  } finally {
    console.warn = before
  }
})

test('gets one Session summary without listing, and null for one Claude does not know', async () => {
  const reader = {
    list: async () => {
      throw new Error('A single summary must not list every Session.')
    },
    get: async (nativeId: string) =>
      nativeId === ID_ONE
        ? { sessionId: ID_ONE, summary: 'New Session', lastModified: 3 }
        : undefined,
  }
  expect(await getClaudeSessionSummary(ID_ONE, reader)).toEqual({
    nativeId: ID_ONE,
    preview: 'New Session',
    activityAt: 3,
  })
  expect(await getClaudeSessionSummary(ID_TWO, reader)).toBeNull()
})
