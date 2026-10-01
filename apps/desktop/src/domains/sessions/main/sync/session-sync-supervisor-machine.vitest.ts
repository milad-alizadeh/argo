import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor, fromCallback } from 'xstate'
import type { SessionSummaryList } from '@/domains/sessions/api/session-discovery'
import type { Harness } from '@/harnesses/harness'
import { migratedDatabase } from '@/mocks/database/migrated-database'
import { SessionListChanges } from '../api'
import type { SessionSyncStatus } from '../session-sync-status'
import {
  type SessionSyncActorInput,
  sessionSyncSupervisorMachine,
} from './session-sync-supervisor-machine'

const changes = new SessionListChanges()
const claudeDiscovery: SessionSummaryList = async () => ({ records: [], skipped: 0 })
const codexDiscovery: SessionSummaryList = async () => ({ records: [], skipped: 0 })
const getSessionSummary = async () => null
const fetchingStatus = {
  phase: 'fetching' as const,
  processed: 0,
  total: null,
  skipped: 0,
  failure: null,
}
type SyncEvent =
  | {
      type: 'SyncStatus'
      harness: Harness
      status: SessionSyncStatus
    }
  | { type: 'SyncCompleted'; harness: Harness }
  | { type: 'SyncFailed'; harness: Harness }

test('dispatches registered Session discovery functions and runs a Refresh that arrived mid-sync once after it', () => {
  const database = migratedDatabase()
  const dispatched: string[] = []
  const finished: Array<() => void> = []
  let stopped = 0
  const machine = sessionSyncSupervisorMachine.provide({
    actors: {
      sync: fromCallback<{ type: 'Stop' }, SessionSyncActorInput, SyncEvent>(
        ({ input, sendBack }) => {
          dispatched.push(input.harness)
          finished.push(() => sendBack({ type: 'SyncCompleted', harness: input.harness }))
          sendBack({ type: 'SyncStatus', harness: input.harness, status: fetchingStatus })
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
      changes,
      harnesses: {
        claude: { listSessionSummaries: claudeDiscovery, getSessionSummary },
        codex: { listSessionSummaries: codexDiscovery, getSessionSummary },
      },
    },
  }).start()
  try {
    assert.deepEqual(dispatched, [])
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, ['claude', 'codex'])
    assert.deepEqual(
      [
        actor.getSnapshot().context.status.claude?.phase,
        actor.getSnapshot().context.status.codex?.phase,
      ],
      ['fetching', 'fetching'],
    )
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
  }
})

test('dispatches only discovery functions selected by the Harness registry', () => {
  const database = migratedDatabase()
  const dispatched: SessionSummaryList[] = []
  const actor = createActor(
    sessionSyncSupervisorMachine.provide({
      actors: {
        sync: fromCallback<{ type: 'Stop' }, SessionSyncActorInput, SyncEvent>(({ input }) => {
          dispatched.push(input.listSessionSummaries)
        }),
      },
    }),
    {
      input: {
        database,
        changes,
        harnesses: { claude: { listSessionSummaries: claudeDiscovery, getSessionSummary } },
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
  const database = migratedDatabase()
  const actor = createActor(sessionSyncSupervisorMachine, {
    input: {
      database,
      changes,
      harnesses: { claude: { listSessionSummaries: claudeDiscovery, getSessionSummary } },
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
      failure: 'Codex app-server is unavailable.',
    },
  })
  assert.equal(actor.getSnapshot().context.status.claude?.phase, 'idle')
  assert.equal(actor.getSnapshot().context.status.codex?.phase, 'failed')
  actor.stop()
})
