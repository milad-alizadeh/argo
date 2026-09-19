import { parentPort, workerData } from 'node:worker_threads'
import { sessionIndexRecoveryKind } from '@/domains/sessions/main/session-index/recovery'
import type { SessionIndexStore } from '@/domains/sessions/main/session-index/store'
import { createSessionIndexStore } from '@/domains/sessions/main/session-index/store'
import {
  type SessionIndexWorkerResponse,
  sessionIndexWorkerDataSchema,
  sessionIndexWorkerRequestSchema,
} from '@/domains/sessions/main/session-index/worker-protocol'

const port = parentPort
if (port === null) throw new Error('The Session index worker needs a parent port.')
const { databasePath } = sessionIndexWorkerDataSchema.parse(workerData)
const store = createSessionIndexStore(databasePath)

const operations = {
  filesAt: (args: unknown[]) => Reflect.apply(store.filesAt, store, args),
  filesOfChains: (args: unknown[]) => Reflect.apply(store.filesOfChains, store, args),
  rowsOfChains: (args: unknown[]) => Reflect.apply(store.rowsOfChains, store, args),
  searchChains: (args: unknown[]) => Reflect.apply(store.searchChains, store, args),
  chainLinks: (args: unknown[]) => Reflect.apply(store.chainLinks, store, args),
  strandedChains: (args: unknown[]) => Reflect.apply(store.strandedChains, store, args),
  write: (args: unknown[]) => Reflect.apply(store.write, store, args),
  backfillProgress: (args: unknown[]) => Reflect.apply(store.backfillProgress, store, args),
  setBackfillProgress: (args: unknown[]) => Reflect.apply(store.setBackfillProgress, store, args),
} satisfies Record<Exclude<keyof SessionIndexStore, 'close'>, (args: unknown[]) => unknown>

port.on('message', (message: unknown) => {
  const request = sessionIndexWorkerRequestSchema.parse(message)
  let response: SessionIndexWorkerResponse
  try {
    response = { id: request.id, ok: true, result: operations[request.operation](request.args) }
  } catch (error) {
    const recovery = sessionIndexRecoveryKind(error)
    response = {
      id: request.id,
      ok: false,
      kind: recovery === null ? 'internal' : 'fallback',
      recovery,
      message: error instanceof Error ? error.message : 'Session index operation failed.',
    }
  }
  port.postMessage(response)
})
