import { DatabaseSync } from 'node:sqlite'
import { parentPort, workerData } from 'node:worker_threads'
import { createActor, fromPromise } from 'xstate'
import { databaseFrom } from '@/database/database'
import { fetchClaudeSessions, saveClaudeSessions } from './run-claude-session-sync'
import { sessionSyncMachine } from './session-sync-machine'
import { type SessionSyncStatus, sessionSyncStatusSchema } from './session-sync-status'

const port = parentPort
if (port === null) throw new Error('The Session sync worker requires a parent port.')
const data = workerData as { databasePath: string }
const client = new DatabaseSync(data.databasePath)
client.exec('PRAGMA journal_mode = WAL')
client.exec('PRAGMA busy_timeout = 5000')
const database = databaseFrom(client)

function statusFor(snapshot: ReturnType<typeof actor.getSnapshot>): SessionSyncStatus {
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
    total: snapshot.matches('Idle') ? null : snapshot.context.records.length,
    skipped: snapshot.context.skipped,
    lastSuccessfulSyncAt: snapshot.context.lastSuccessfulSyncAt,
    failure: snapshot.context.failure,
  })
}

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
})
port.on('message', (message: unknown) => {
  if (message === 'Refresh') actor.send({ type: 'Refresh' })
})
actor.start()
actor.send({ type: 'Start' })
