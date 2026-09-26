import { expect, test } from 'bun:test'
import { createActor, waitFor } from 'xstate'
import { claudeSessionSyncActor } from './claude-session-sync-actor'

const ID_ONE = '00000000-0000-4000-8000-000000000001'
const ID_TWO = '00000000-0000-4000-8000-000000000002'

test('returns generic Session records and counts malformed Claude metadata', async () => {
  const requested: string[] = []
  const actor = createActor(claudeSessionSyncActor, {
    input: {
      knownNativeIds: [ID_ONE],
      reader: {
        list: async () => [{ sessionId: 'invalid', summary: 'Bad', lastModified: 1 }],
        get: async (nativeId) => {
          requested.push(nativeId)
          return { sessionId: ID_ONE, summary: 'Known Session', lastModified: 2 }
        },
      },
    },
  }).start()
  try {
    const snapshot = await waitFor(actor, (current) => current.status === 'done')
    expect(requested).toEqual([ID_ONE])
    expect(snapshot.output).toEqual({
      records: [{ nativeId: ID_ONE, preview: 'Known Session', activityAt: 2 }],
      skipped: 1,
    })
  } finally {
    actor.stop()
  }
})

test('reads interactive Sessions and gets metadata for known Argo Sessions', async () => {
  const requested: string[] = []
  const actor = createActor(claudeSessionSyncActor, {
    input: {
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
    },
  }).start()
  try {
    const snapshot = await waitFor(actor, (current) => current.status === 'done')
    expect(requested).toEqual([ID_TWO])
    expect(snapshot.output).toEqual({
      records: [
        { nativeId: ID_ONE, activityAt: 1, preview: 'External Session', cwd: '/repo' },
        { nativeId: ID_TWO, activityAt: 2, customTitle: 'Pinned', preview: 'Argo Session' },
      ],
      skipped: 1,
    })
  } finally {
    actor.stop()
  }
})

test('distinguishes a missing custom title from an explicit removal', async () => {
  const actor = createActor(claudeSessionSyncActor, {
    input: {
      knownNativeIds: [],
      reader: {
        list: async () => [
          { sessionId: ID_ONE, summary: 'Sparse Session', lastModified: 1 },
          { sessionId: ID_TWO, summary: 'Cleared Session', lastModified: 2, customTitle: null },
        ],
        get: async () => undefined,
      },
    },
  }).start()
  try {
    const snapshot = await waitFor(actor, (current) => current.status === 'done')
    expect(snapshot.output?.records[0]).not.toHaveProperty('customTitle')
    expect(snapshot.output?.records[1]).toHaveProperty('customTitle', null)
  } finally {
    actor.stop()
  }
})
