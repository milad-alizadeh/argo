import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor, fromCallback } from 'xstate'
import type { SessionDiscoveryJob } from '@/harnesses/session-sync-job'
import { SessionSyncStatusStore } from '../api/session-sync-status'
import {
  type SessionSyncWorkerActorInput,
  sessionSyncSupervisorMachine,
} from './session-sync-supervisor-machine'

const claudeDiscoveryJob: SessionDiscoveryJob = {
  kind: 'claude-session-discovery',
  harness: 'claude',
}
const discoveryJobs: SessionDiscoveryJob[] = [
  claudeDiscoveryJob,
  { kind: 'codex-session-discovery', harness: 'codex' },
]

type WorkerEvent =
  | { type: 'WorkerReady'; harness: 'claude' | 'codex' }
  | {
      type: 'WorkerStatus'
      harness: 'claude' | 'codex'
      status: ReturnType<SessionSyncStatusStore['current']>
    }
  | { type: 'WorkerCommitted'; harness: 'claude' | 'codex' }
  | { type: 'WorkerCompleted'; harness: 'claude' | 'codex' }
  | { type: 'WorkerFailed'; harness: 'claude' | 'codex' }

test('dispatches registered Session discovery jobs and deduplicates Refresh', () => {
  const dispatched: string[] = []
  const finished: Array<() => void> = []
  let stopped = 0
  const status = new SessionSyncStatusStore()
  const reported: string[] = []
  const unsubscribe = status.subscribe((event) => reported.push(event.type))
  const machine = sessionSyncSupervisorMachine.provide({
    actors: {
      worker: fromCallback<{ type: 'Stop' }, SessionSyncWorkerActorInput, WorkerEvent>(
        ({ input, sendBack }) => {
          dispatched.push(input.job.harness)
          finished.push(() => sendBack({ type: 'WorkerCompleted', harness: input.job.harness }))
          sendBack({ type: 'WorkerReady', harness: input.job.harness })
          sendBack({
            type: 'WorkerStatus',
            harness: input.job.harness,
            status: {
              phase: 'fetching',
              processed: 0,
              total: null,
              skipped: 0,
              lastSuccessfulSyncAt: null,
              failure: null,
            },
          })
          sendBack({ type: 'WorkerCommitted', harness: input.job.harness })
          return () => {
            stopped += 1
          }
        },
      ),
    },
  })
  const actor = createActor(machine, {
    input: {
      databasePath: '/tmp/session-sync-test.sqlite',
      status: { claude: status, codex: new SessionSyncStatusStore(undefined, 'codex') },
    },
  }).start()
  try {
    assert.deepEqual(dispatched, [])
    actor.send({ type: 'RegisterJobs', jobs: discoveryJobs })
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

test('dispatches only discovery jobs selected by registered Harnesses', () => {
  const dispatched: SessionDiscoveryJob[] = []
  const actor = createActor(
    sessionSyncSupervisorMachine.provide({
      actors: {
        worker: fromCallback<{ type: 'Stop' }, SessionSyncWorkerActorInput, WorkerEvent>(
          ({ input }) => {
            dispatched.push(input.job)
          },
        ),
      },
    }),
    {
      input: {
        databasePath: '/tmp/session-sync-test.sqlite',
        status: { claude: new SessionSyncStatusStore() },
      },
    },
  ).start()
  try {
    actor.send({ type: 'RegisterJobs', jobs: [claudeDiscoveryJob] })
    assert.deepEqual(dispatched, [])
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, [claudeDiscoveryJob])
    actor.send({ type: 'RegisterJobs', jobs: discoveryJobs })
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, [claudeDiscoveryJob])
  } finally {
    actor.stop()
  }
})

test('keeps a Codex sync failure out of Claude status', () => {
  const claudeStatus = new SessionSyncStatusStore()
  const codexStatus = new SessionSyncStatusStore(undefined, 'codex')
  const actor = createActor(sessionSyncSupervisorMachine, {
    input: {
      databasePath: null,
      status: { claude: claudeStatus, codex: codexStatus },
    },
  }).start()
  actor.send({
    type: 'WorkerStatus',
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
