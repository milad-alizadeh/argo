import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { SessionIndex } from '@/domains/sessions/main/index/session-index/contract'
import { SessionIndexFallbackError } from '@/domains/sessions/main/index/session-index/recovery'
import { sessionIndexWorkerResponseSchema } from '@/domains/sessions/main/index/session-index/worker-protocol'

type SessionIndexOperation = Exclude<keyof SessionIndex, 'close'>

export type SessionIndexWorkerPort = {
  call: (operation: SessionIndexOperation, args: readonly unknown[]) => Promise<unknown>
  close: () => Promise<void>
}

export class SessionIndexWorkerStoppedError extends Error {
  constructor(cause?: unknown) {
    super('The Session index worker stopped.', { cause })
    this.name = 'SessionIndexWorkerStoppedError'
  }
}

function threadPort(databasePath: string): SessionIndexWorkerPort {
  mkdirSync(path.dirname(databasePath), { recursive: true })
  const worker = new Worker(path.join(__dirname, 'session-index-worker.js'), {
    workerData: { databasePath },
  })
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >()
  let nextId = 0
  let closed = false

  function stop(error: SessionIndexWorkerStoppedError) {
    for (const request of pending.values()) request.reject(error)
    pending.clear()
  }

  worker.on('message', (message: unknown) => {
    const parsed = sessionIndexWorkerResponseSchema.safeParse(message)
    if (!parsed.success) {
      stop(new SessionIndexWorkerStoppedError(parsed.error))
      return
    }
    const request = pending.get(parsed.data.id)
    if (request === undefined) return
    pending.delete(parsed.data.id)
    if (parsed.data.ok) {
      request.resolve(parsed.data.result)
      return
    }
    request.reject(
      parsed.data.kind === 'fallback'
        ? new SessionIndexFallbackError(parsed.data.recovery ?? 'busy', parsed.data.message)
        : new Error(parsed.data.message),
    )
  })
  worker.on('error', (error) => stop(new SessionIndexWorkerStoppedError(error)))
  worker.on('exit', () => {
    if (!closed) stop(new SessionIndexWorkerStoppedError())
  })
  worker.unref()

  return {
    call: (operation, args) =>
      new Promise((resolve, reject) => {
        const id = nextId
        nextId += 1
        pending.set(id, { resolve, reject })
        const request = { id, operation, args: [...args] }
        worker.postMessage(request)
      }),
    close: async () => {
      if (closed) return
      closed = true
      stop(new SessionIndexWorkerStoppedError())
      await worker.terminate()
    },
  }
}

export function createWorkerSessionIndex(
  databasePath: string,
  startWorker: () => SessionIndexWorkerPort = () => threadPort(databasePath),
): SessionIndex {
  let worker: SessionIndexWorkerPort | null = null
  let closed = false

  async function call<Operation extends SessionIndexOperation>(
    operation: Operation,
    ...args: Parameters<SessionIndex[Operation]>
  ): Promise<Awaited<ReturnType<SessionIndex[Operation]>>> {
    if (closed) throw new SessionIndexWorkerStoppedError()
    if (worker === null) worker = startWorker()
    const current = worker
    try {
      return (await current.call(operation, args)) as Awaited<ReturnType<SessionIndex[Operation]>>
    } catch (error) {
      if (error instanceof SessionIndexFallbackError && error.recovery === 'damaged') {
        worker = null
        await current.close().catch(() => undefined)
      }
      if (error instanceof SessionIndexWorkerStoppedError && worker === current) {
        worker = null
        await current.close().catch(() => undefined)
      }
      throw error
    }
  }

  return {
    filesAt: (harness, paths) => call('filesAt', harness, paths),
    filesOfChains: (harness, chainIds) => call('filesOfChains', harness, chainIds),
    rowsOfChains: (harness, chainIds) => call('rowsOfChains', harness, chainIds),
    searchChains: (harness, query) => call('searchChains', harness, query),
    chainLinks: (harness) => call('chainLinks', harness),
    strandedChains: (harness) => call('strandedChains', harness),
    write: (harness, pass) => call('write', harness, pass),
    backfillProgress: (harness) => call('backfillProgress', harness),
    setBackfillProgress: (harness, progress) => call('setBackfillProgress', harness, progress),
    close: async () => {
      if (closed) return
      closed = true
      const current = worker
      worker = null
      await current?.close()
    },
  }
}
