import assert from 'node:assert/strict'
import { test } from 'vitest'
import { databaseFrom } from '@/database/database'
import {
  claudeCatalog,
  claudeFirst,
  passiveChannelMethods,
  start,
  supervisorFor,
} from '@/mocks/sessions/live-session-supervisor.fixture'
import { sessionListCaller } from '@/mocks/sessions/session-list-caller'

test('session.list projects the latest live status event and announces each change', async () => {
  let emitStatus!: (status: 'running' | 'idle' | 'permission') => void
  const { root, supervisor, client } = await supervisorFor(
    async () => {
      throw new Error('Codex must not be called.')
    },
    claudeCatalog,
    (input, _controls, emit) => {
      emitStatus = (status) =>
        emit({
          type: 'feed',
          body: {
            type: 'status',
            commandId: input.commandId,
            turnId: null,
            vendorEventId: null,
            status,
          },
        })
      queueMicrotask(() => emit({ type: 'identity', nativeId: 'native-1' }))
      return { submit: async () => {}, ...passiveChannelMethods }
    },
  )
  const { list, stopWatching } = sessionListCaller({ database: databaseFrom(client), supervisor })
  const statusOf = async () => (await list({ projectId: 'project-1' })).rows[0]?.status
  const announced: string[] = []
  const subscription = supervisor.on('Session status changed', ({ sessionId }) =>
    announced.push(sessionId),
  )
  try {
    const { sessionId } = await start(supervisor, claudeFirst)
    assert.equal(await statusOf(), 'starting')
    assert.deepEqual(announced, [sessionId])
    for (const status of ['running', 'permission', 'idle'] as const) {
      emitStatus(status)
      assert.equal(await statusOf(), status)
    }
    assert.deepEqual(announced, [sessionId, sessionId, sessionId, sessionId])
  } finally {
    subscription.unsubscribe()
    stopWatching()
    root.send({ type: 'Shutdown' })
    client.close()
  }
})
