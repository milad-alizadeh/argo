import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor, fromCallback } from 'xstate'
import type { Database } from '@/database/database'
import type { SessionDiscovery } from '@/domains/sessions/api/session-discovery'
import { SessionSyncStatusStore } from '../api/session-sync-status'
import {
  type SessionSyncActorInput,
  sessionSyncSupervisorMachine,
} from './session-sync-supervisor-machine'

const database = {} as Database
const claudeDiscovery: SessionDiscovery = async () => ({ records: [], skipped: 0 })
const codexDiscovery: SessionDiscovery = async () => ({ records: [], skipped: 0 })
const fetchingStatus = {
  phase: 'fetching' as const,
  processed: 0,
  total: null,
  skipped: 0,
  lastSuccessfulSyncAt: null,
  failure: null,
}
type SyncEvent =
  | {
      type: 'SyncStatus'
      harness: 'claude' | 'codex'
      status: ReturnType<SessionSyncStatusStore['current']>
    }
  | { type: 'SyncCommitted'; harness: 'claude' | 'codex' }
  | { type: 'SyncCompleted'; harness: 'claude' | 'codex' }
  | { type: 'SyncFailed'; harness: 'claude' | 'codex' }

test('dispatches registered Session discovery functions and deduplicates Refresh', () => {
  const dispatched: string[] = []
  const finished: Array<() => void> = []
  let stopped = 0
  const status = new SessionSyncStatusStore()
  const reported: string[] = []
  const unsubscribe = status.subscribe((event) => reported.push(event.type))
  const machine = sessionSyncSupervisorMachine.provide({
    actors: {
      sync: fromCallback<{ type: 'Stop' }, SessionSyncActorInput, SyncEvent>(
        ({ input, sendBack }) => {
          dispatched.push(input.harness)
          finished.push(() => sendBack({ type: 'SyncCompleted', harness: input.harness }))
          sendBack({ type: 'SyncStatus', harness: input.harness, status: fetchingStatus })
          sendBack({ type: 'SyncCommitted', harness: input.harness })
          return () => {
            stopped += 1
          }
        },
      ),
    },
  })
  const actor = createActor(machine, {
    input: {
      database,
      harnesses: {
        claude: { sessionDiscovery: claudeDiscovery },
        codex: { sessionDiscovery: codexDiscovery },
      },
      status: { claude: status, codex: new SessionSyncStatusStore(undefined, 'codex') },
    },
  }).start()
  try {
    assert.deepEqual(dispatched, [])
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, ['claude', 'codex'])
    assert.equal(status.current().phase, 'fetching')
    assert.deepEqual(reported, ['status', 'status', 'committed'])
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, ['claude', 'codex'])
    finished[0]?.()
    finished[1]?.()
    assert.equal(stopped, 2)
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, ['claude', 'codex', 'claude', 'codex'])
    actor.send({ type: 'Shutdown' })
    assert.ok(actor.getSnapshot().matches('Closed'))
    assert.equal(stopped, 4)
  } finally {
    actor.stop()
    unsubscribe()
  }
})

test('dispatches only discovery functions selected by the Harness registry', () => {
  const dispatched: SessionDiscovery[] = []
  const actor = createActor(
    sessionSyncSupervisorMachine.provide({
      actors: {
        sync: fromCallback<{ type: 'Stop' }, SessionSyncActorInput, SyncEvent>(({ input }) => {
          dispatched.push(input.sessionDiscovery)
        }),
      },
    }),
    {
      input: {
        database,
        harnesses: { claude: { sessionDiscovery: claudeDiscovery } },
        status: { claude: new SessionSyncStatusStore() },
      },
    },
  ).start()
  try {
    assert.deepEqual(dispatched, [])
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, [claudeDiscovery])
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, [claudeDiscovery])
  } finally {
    actor.stop()
  }
})

test('keeps a Codex sync failure out of Claude status', () => {
  const claudeStatus = new SessionSyncStatusStore()
  const codexStatus = new SessionSyncStatusStore(undefined, 'codex')
  const actor = createActor(sessionSyncSupervisorMachine, {
    input: {
      database,
      harnesses: {},
      status: { claude: claudeStatus, codex: codexStatus },
    },
  }).start()
  actor.send({
    type: 'SyncStatus',
    harness: 'codex',
    status: {
      phase: 'failed',
      processed: 0,
      total: null,
      skipped: 0,
      lastSuccessfulSyncAt: null,
      failure: 'Codex app-server is unavailable.',
    },
  })
  assert.equal(claudeStatus.current().phase, 'idle')
  assert.equal(codexStatus.current().phase, 'failed')
  actor.stop()
})
