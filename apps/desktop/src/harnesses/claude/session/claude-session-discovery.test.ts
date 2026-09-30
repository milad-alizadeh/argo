import { expect, test } from 'bun:test'
import { getClaudeSessionSummary, listClaudeSessionSummaries } from './claude-session-discovery'

const ID_ONE = '00000000-0000-4000-8000-000000000001'
const ID_TWO = '00000000-0000-4000-8000-000000000002'

test('returns generic Session records and counts malformed Claude metadata', async () => {
  const requested: string[] = []
  const result = await listClaudeSessionSummaries({
    knownNativeIds: [ID_ONE],
    reader: {
      list: async () => [{ sessionId: 'invalid', summary: 'Bad', lastModified: 1 }],
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

test('distinguishes a missing custom title from an explicit removal', async () => {
  const result = await listClaudeSessionSummaries({
    knownNativeIds: [],
    reader: {
      list: async () => [
        { sessionId: ID_ONE, summary: 'Sparse Session', lastModified: 1 },
        { sessionId: ID_TWO, summary: 'Cleared Session', lastModified: 2, customTitle: null },
      ],
      get: async () => undefined,
    },
  })
  expect(result.records[0]).not.toHaveProperty('customTitle')
  expect(result.records[1]).toHaveProperty('customTitle', null)
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
