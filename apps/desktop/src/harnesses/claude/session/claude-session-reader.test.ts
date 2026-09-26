import { expect, test } from 'bun:test'
import { readClaudeSessions } from './claude-session-reader'

const ID_ONE = '00000000-0000-4000-8000-000000000001'
const ID_TWO = '00000000-0000-4000-8000-000000000002'

test('reads interactive Sessions and gets metadata for known Argo Sessions', async () => {
  const malformed: unknown[] = []
  const records = await readClaudeSessions({
    reader: {
      list: async () => [
        { sessionId: ID_ONE, summary: 'External Session', lastModified: 1, cwd: '/repo' },
        { sessionId: 'not-a-uuid', summary: 'Bad', lastModified: 1 },
      ],
      get: async (nativeId) =>
        nativeId === ID_TWO
          ? { sessionId: ID_TWO, summary: 'Argo Session', lastModified: 2, customTitle: 'Pinned' }
          : undefined,
    },
    knownNativeIds: [ID_ONE, ID_TWO],
    reportMalformed: (raw) => malformed.push(raw),
  })

  expect(records).toEqual([
    {
      nativeId: ID_ONE,
      activityAt: 1,
      preview: 'External Session',
      cwd: '/repo',
    },
    { nativeId: ID_TWO, activityAt: 2, customTitle: 'Pinned', preview: 'Argo Session' },
  ])
  expect(malformed).toHaveLength(1)
})

test('distinguishes a missing custom title from an explicit removal', async () => {
  const records = await readClaudeSessions({
    reader: {
      list: async () => [
        { sessionId: ID_ONE, summary: 'Sparse Session', lastModified: 1 },
        {
          sessionId: ID_TWO,
          summary: 'Cleared Session',
          lastModified: 2,
          customTitle: null,
        },
      ],
      get: async () => undefined,
    },
    knownNativeIds: [],
    reportMalformed: () => {},
  })

  expect(records[0]).not.toHaveProperty('customTitle')
  expect(records[1]).toHaveProperty('customTitle', null)
})
