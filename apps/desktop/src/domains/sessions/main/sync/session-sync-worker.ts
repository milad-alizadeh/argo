import { DatabaseSync } from 'node:sqlite'
import { type MessagePort, parentPort, workerData } from 'node:worker_threads'
import { createActor, fromPromise, type SnapshotFrom } from 'xstate'
import { z } from 'zod'
import { databaseFrom } from '@/database/database'
import { type SessionSyncStatus, sessionSyncStatusSchema } from '../api/session-sync-status'
import { fetchClaudeSessions, saveClaudeSessions } from './run-claude-session-sync'
import { sessionSyncMachine } from './session-sync-machine'

function statusFor(snapshot: SnapshotFrom<typeof sessionSyncMachine>): SessionSyncStatus {
  const phaseByState = {
    Idle: 'idle',
    Fetching: 'fetching',
    Saving: 'saving',
    Ready: 'ready',
    Failed: 'failed',
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

function startSessionSyncWorker(port: MessagePort, databasePath: string): void {
  const client = new DatabaseSync(databasePath)
  client.exec('PRAGMA journal_mode = WAL')
  client.exec('PRAGMA busy_timeout = 5000')
  const database = databaseFrom(client)

  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        fetch: fromPromise(async () => {
          let skipped = 0
          const records = await fetchClaudeSessions({
            database,
            reportMalformed: () => {
              skipped += 1
            },
          })
          return { records, skipped }
        }),
        save: fromPromise(async ({ input }) => {
          saveClaudeSessions(database, input.records, () => port.postMessage({ type: 'committed' }))
        }),
      },
    }),
  )
  actor.subscribe((snapshot) => {
    port.postMessage({ type: 'status', status: statusFor(snapshot) })
    if (snapshot.matches('Ready') && snapshot.context.skipped > 0)
      console.warn(`Claude Session sync skipped ${snapshot.context.skipped} malformed records.`)
  })
  let closed = false
  function close(): void {
    if (closed) return
    closed = true
    actor.stop()
    client.close()
    port.close()
  }
  port.on('message', (message: unknown) => {
    if (message === 'Refresh') actor.send({ type: 'Refresh' })
    else if (message === 'Shutdown') close()
    else console.error('Invalid Session sync worker command.', message)
  })
  port.on('close', close)
  actor.start()
  actor.send({ type: 'Start' })
}

if (parentPort === null) throw new Error('The Session sync worker requires a parent port.')
const data = z.strictObject({ databasePath: z.string().min(1) }).parse(workerData)
startSessionSyncWorker(parentPort, data.databasePath)
