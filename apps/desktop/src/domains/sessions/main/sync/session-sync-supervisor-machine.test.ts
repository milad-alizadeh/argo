import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor, fromCallback } from 'xstate'
import type { Database } from '@/database/database'
import type { SessionDiscovery } from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
import { SessionSyncStatusStore } from '../session-sync-status'
import {
  type SessionSyncActorInput,
  sessionSyncSupervisorMachine,
} from './session-sync-supervisor-machine'

const database = {} as Database
const claudeDiscovery: SessionDiscovery = async () => ({ records: [], skipped: 0 })
const codexDiscovery: SessionDiscovery = async () => ({ records: [], skipped: 0 })
const readHistory = async () => []
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
      harness: Harness
      status: ReturnType<SessionSyncStatusStore['current']>
    }
  | { type: 'SyncCommitted'; harness: Harness }
  | { type: 'SyncStored'; harness: Harness }
  | { type: 'SyncCompleted'; harness: Harness }
  | { type: 'SyncFailed'; harness: Harness }

test('dispatches registered Session discovery functions and runs a Refresh that arrived mid-sync once after it', () => {
  const dispatched: string[] = []
  const finished: Array<() => void> = []
  let stopped = 0
  const status = new SessionSyncStatusStore(undefined, 'claude')
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
        claude: { sessionDiscovery: claudeDiscovery, readHistory },
        codex: { sessionDiscovery: codexDiscovery, readHistory },
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
    assert.deepEqual(dispatched, ['claude', 'codex', 'claude', 'codex'])
    finished[2]?.()
    finished[3]?.()
    assert.deepEqual(dispatched, ['claude', 'codex', 'claude', 'codex'])
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, ['claude', 'codex', 'claude', 'codex', 'claude', 'codex'])
    actor.send({ type: 'Shutdown' })
    assert.ok(actor.getSnapshot().matches('Closed'))
    assert.equal(stopped, 6)
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
        harnesses: { claude: { sessionDiscovery: claudeDiscovery, readHistory } },
        status: { claude: new SessionSyncStatusStore(undefined, 'claude') },
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
  const claudeStatus = new SessionSyncStatusStore(undefined, 'claude')
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
