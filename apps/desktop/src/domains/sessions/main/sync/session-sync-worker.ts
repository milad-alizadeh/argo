import { DatabaseSync } from 'node:sqlite'
import { type MessagePort, parentPort, workerData } from 'node:worker_threads'
import { createActor, fromPromise, type SnapshotFrom } from 'xstate'
import { z } from 'zod'
import { databaseFrom } from '@/database/database'
import { claudeSessionSyncActor } from '@/harnesses/claude/session/claude-session-sync-actor'
import { type Harness, harnessSchema } from '@/harnesses/harness'
import { type SessionSyncStatus, sessionSyncStatusSchema } from '../api/session-sync-status'
import { sessionSyncMachine } from './session-sync-machine'
import { knownSessionIds, matchSessionsToProjects, saveSessionBatch } from './session-sync-records'

function statusFor(snapshot: SnapshotFrom<typeof sessionSyncMachine>): SessionSyncStatus {
  const phaseByState = {
    Idle: 'idle',
    Fetching: 'fetching',
    Saving: 'saving',
    Ready: 'ready',
    Failed: 'failed',
    Closed: 'idle',
  } as const
  return sessionSyncStatusSchema.parse({
    phase: phaseByState[snapshot.value],
    processed: snapshot.context.processed,
    total:
      snapshot.matches('Idle') || snapshot.matches('Fetching')
        ? null
        : snapshot.context.records.length,
    skipped: snapshot.context.skipped,
    lastSuccessfulSyncAt: snapshot.context.lastSuccessfulSyncAt,
    failure: snapshot.context.failure,
  })
}

function fetchActorFor(harness: Harness) {
  switch (harness) {
    case 'claude':
      return claudeSessionSyncActor
    case 'codex':
      throw new Error('Codex Session sync is not supported yet.')
    default: {
      const unknownHarness: never = harness
      throw new Error(`Unsupported Session sync Harness: ${unknownHarness}`)
    }
  }
}

function startSessionSyncWorker(port: MessagePort, databasePath: string, harness: Harness): void {
  const client = new DatabaseSync(databasePath)
  client.exec('PRAGMA journal_mode = WAL')
  client.exec('PRAGMA busy_timeout = 5000')
  const database = databaseFrom(client)
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        fetch: fetchActorFor(harness),
        save: fromPromise(async ({ input }) => {
          saveSessionBatch(database, harness, matchSessionsToProjects(database, input.records))
          port.postMessage({ type: 'committed' })
        }),
      },
    }),
    { input: { harness, knownNativeIds: knownSessionIds(database, harness) } },
  )
  let closed = false
  function close(): void {
    if (closed) return
    closed = true
    actor.stop()
    client.close()
    port.close()
  }
  actor.subscribe((snapshot) => {
    if (snapshot.matches('Closed')) return
    port.postMessage({ type: 'status', status: statusFor(snapshot) })
    if (snapshot.matches('Ready') || snapshot.matches('Failed')) {
      if (snapshot.matches('Ready') && snapshot.context.skipped > 0)
        console.warn(
          `${harness} Session sync skipped ${snapshot.context.skipped} malformed records.`,
        )
      port.postMessage({
        type: 'finished',
        outcome: snapshot.matches('Ready') ? 'ready' : 'failed',
      })
      setImmediate(close)
    }
  })
  port.on('message', (message: unknown) => {
    if (message === 'Shutdown') close()
    else console.error('Invalid Session sync worker command.', message)
  })
  port.on('close', close)
  actor.start()
  actor.send({ type: 'Start' })
}

if (parentPort === null) throw new Error('The Session sync worker requires a parent port.')
const data = z
  .strictObject({ databasePath: z.string().min(1), harness: harnessSchema })
  .parse(workerData)
startSessionSyncWorker(parentPort, data.databasePath, data.harness)
