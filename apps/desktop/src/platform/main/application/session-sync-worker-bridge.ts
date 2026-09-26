import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { fromCallback } from 'xstate'
import {
  type SessionSyncStatusStore,
  sessionSyncEventSchema,
} from '@/domains/sessions/main/api/session-sync-status'

export type SessionSyncWorkerBridgeInput = {
  databasePath: string | null
  status: SessionSyncStatusStore
}

export const sessionSyncWorkerBridge = fromCallback<
  { type: 'Refresh' },
  SessionSyncWorkerBridgeInput
>(({ input, receive }) => {
  if (input.databasePath === null) return () => {}

  const worker = new Worker(path.join(__dirname, 'session-sync-worker.js'), {
    workerData: { databasePath: input.databasePath },
  })
  worker.unref()
  let stopping = false
  let forcedStop: ReturnType<typeof setTimeout> | undefined

  worker.on('message', (message: unknown) => {
    if (stopping) return
    const parsed = sessionSyncEventSchema.safeParse(message)
    if (!parsed.success) {
      console.error('Invalid Session sync worker message.', parsed.error)
      return
    }
    switch (parsed.data.type) {
      case 'status':
        input.status.update(parsed.data.status)
        break
      case 'committed':
        input.status.committed()
        break
    }
  })
  worker.on('error', (error) => {
    if (stopping) return
    input.status.update({
      ...input.status.current(),
      phase: 'failed',
      failure: String(error),
    })
  })
  worker.on('exit', (code) => {
    if (forcedStop !== undefined) clearTimeout(forcedStop)
    if (stopping) return
    input.status.update({
      ...input.status.current(),
      phase: 'failed',
      failure: `Session sync worker exited with code ${code}.`,
    })
  })
  receive((event) => {
    if (event.type === 'Refresh') worker.postMessage('Refresh')
  })

  return () => {
    stopping = true
    forcedStop = setTimeout(() => void worker.terminate(), 5000)
    forcedStop.unref()
    try {
      worker.postMessage('Shutdown')
    } catch {
      void worker.terminate()
    }
  }
})
