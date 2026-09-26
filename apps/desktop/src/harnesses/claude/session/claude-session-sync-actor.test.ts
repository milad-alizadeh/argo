import { expect, test } from 'bun:test'
import { createActor, waitFor } from 'xstate'
import { claudeSessionSyncActor } from './claude-session-sync-actor'

const knownId = '00000000-0000-4000-8000-000000000001'

test('returns generic Session records and counts malformed Claude metadata', async () => {
  const requested: string[] = []
  const actor = createActor(claudeSessionSyncActor, {
    input: {
      knownNativeIds: [knownId],
      reader: {
        list: async () => [{ sessionId: 'invalid', summary: 'Bad', lastModified: 1 }],
        get: async (nativeId) => {
          requested.push(nativeId)
          return { sessionId: knownId, summary: 'Known Session', lastModified: 2 }
        },
      },
    },
  }).start()
  try {
    const snapshot = await waitFor(actor, (current) => current.status === 'done')
    expect(requested).toEqual([knownId])
    expect(snapshot.output).toEqual({
      records: [{ nativeId: knownId, preview: 'Known Session', activityAt: 2 }],
      skipped: 1,
    })
  } finally {
    actor.stop()
  }
})
