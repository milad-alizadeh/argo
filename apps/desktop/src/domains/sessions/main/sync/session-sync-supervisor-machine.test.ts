import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createActor, fromCallback } from 'xstate'
import { SessionSyncStatusStore } from '../api/session-sync-status'
import {
  type SessionSyncWorkerActorInput,
  sessionSyncSupervisorMachine,
} from './session-sync-supervisor-machine'

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

test('dispatches one thread for the supported Harness and deduplicates Refresh', () => {
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
          dispatched.push(input.harness)
          finished.push(() => sendBack({ type: 'WorkerCompleted', harness: input.harness }))
          sendBack({ type: 'WorkerReady', harness: input.harness })
          sendBack({
            type: 'WorkerStatus',
            harness: input.harness,
            status: {
              phase: 'fetching',
              processed: 0,
              total: null,
              skipped: 0,
              lastSuccessfulSyncAt: null,
              failure: null,
            },
          })
          sendBack({ type: 'WorkerCommitted', harness: input.harness })
          return () => {
            stopped += 1
          }
        },
      ),
    },
  })
  const actor = createActor(machine, {
    input: { databasePath: '/tmp/session-sync-test.sqlite', status: { claude: status } },
  }).start()
  try {
    assert.deepEqual(dispatched, ['claude'])
    assert.equal(status.current().phase, 'fetching')
    assert.deepEqual(reported, ['status', 'status', 'committed'])
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, ['claude'])
    finished[0]?.()
    assert.equal(stopped, 1)
    actor.send({ type: 'Refresh' })
    assert.deepEqual(dispatched, ['claude', 'claude'])
    actor.send({ type: 'Shutdown' })
    assert.ok(actor.getSnapshot().matches('Closed'))
    assert.equal(stopped, 2)
  } finally {
    actor.stop()
    unsubscribe()
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
