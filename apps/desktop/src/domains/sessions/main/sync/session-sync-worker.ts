import { DatabaseSync } from 'node:sqlite'
import { type MessagePort, parentPort, workerData } from 'node:worker_threads'
import { createActor, fromPromise, type SnapshotFrom } from 'xstate'
import { z } from 'zod'
import { databaseFrom } from '@/database/database'
import { claudeSessionSyncActor } from '@/harnesses/claude/session/claude-session-sync-actor'
import { createCodexSessionSyncActor } from '@/harnesses/codex/session/codex-session-sync-actor'
import {
  type CodexWorkerReadRequest,
  createCodexWorkerRequest,
} from '@/harnesses/codex/session/session-sync-codex-bridge'
import { type SessionDiscoveryJob, sessionDiscoveryJobSchema } from '@/harnesses/session-sync-job'
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

function fetchActorFor(job: SessionDiscoveryJob, codexRequest?: CodexWorkerReadRequest) {
  switch (job.kind) {
    case 'claude-session-discovery':
      return claudeSessionSyncActor
    case 'codex-session-discovery': {
      if (codexRequest === undefined)
        throw new Error('Codex Session sync requires the worker request bridge.')
      return createCodexSessionSyncActor(codexRequest)
    }
    default: {
      const unknownJob: never = job
      throw new Error(`Unsupported Session discovery job: ${unknownJob}`)
    }
  }
}

function startSessionSyncWorker(
  port: MessagePort,
  databasePath: string,
  job: SessionDiscoveryJob,
): void {
  const { harness } = job
  const client = new DatabaseSync(databasePath)
  client.exec('PRAGMA journal_mode = WAL')
  client.exec('PRAGMA busy_timeout = 5000')
  const database = databaseFrom(client)
  const codexRequest =
    job.kind === 'codex-session-discovery' ? createCodexWorkerRequest(port) : undefined
  const actor = createActor(
    sessionSyncMachine.provide({
      actors: {
        fetch: fetchActorFor(job, codexRequest),
        save: fromPromise(async ({ input }) => {
          saveSessionBatch(database, harness, matchSessionsToProjects(database, input.records))
          port.postMessage({ type: 'committed' })
        }),
      },
    }),
    { input: { harness, knownNativeIds: knownSessionIds(database, harness) } },
  )
  let closed = false
  let invalidCommandCount = 0
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
    else if (codexRequest?.handlesWorkerMessage(message) === true) return
    else {
      invalidCommandCount += 1
      console.error('Invalid Session sync worker command.', {
        count: invalidCommandCount,
        message,
      })
    }
  })
  port.on('close', close)
  actor.start()
  actor.send({ type: 'Start' })
}

if (parentPort === null) throw new Error('The Session sync worker requires a parent port.')
const data = z
  .strictObject({ databasePath: z.string().min(1), job: sessionDiscoveryJobSchema })
  .parse(workerData)
startSessionSyncWorker(parentPort, data.databasePath, data.job)
