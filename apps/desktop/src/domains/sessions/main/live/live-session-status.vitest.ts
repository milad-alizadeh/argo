import assert from 'node:assert/strict'
import { initTRPC } from '@trpc/server'
import { test } from 'vitest'
import { type Database, databaseFrom } from '@/database/database'
import {
  claudeCatalog,
  claudeFirst,
  passiveChannelMethods,
  start,
  supervisorFor,
} from '@/mocks/sessions/live-session-supervisor.fixture'
import { sessionListProcedure } from '../api/session-list'
import { SessionRosterChanges } from '../api/session-roster-changes'
import type { LiveSessionSupervisorActor } from './live-session-supervisor-machine'

// The status of the first row the roster lists first.
function firstListedStatus(database: Database, supervisor: LiveSessionSupervisorActor) {
  const list = initTRPC
    .create()
    .router({
      list: sessionListProcedure({
        database,
        supervisor,
        roster: new SessionRosterChanges(),
      }),
    })
    .createCaller({}).list
  return async () => (await list({ projectId: 'project-1' })).rows[0]?.status
}

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
  const statusOf = firstListedStatus(databaseFrom(client), supervisor)
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
    root.send({ type: 'Shutdown' })
    client.close()
  }
})
