import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { fromCallback } from 'xstate'
import { type SessionSyncStatusStore, sessionSyncStatusSchema } from './session-sync-status'

export const sessionSyncWorkerActor = fromCallback<
  { type: 'Refresh' },
  { databasePath: string | null; status: SessionSyncStatusStore }
>(({ input, receive }) => {
  if (input.databasePath === null) return () => {}
  const worker = new Worker(path.join(__dirname, 'session-sync-worker.js'), {
    workerData: { databasePath: input.databasePath },
  })
  worker.on('message', (message: unknown) => {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as { type?: unknown }).type === 'committed'
    ) {
      input.status.update(input.status.current())
      return
    }
    const parsed = sessionSyncStatusSchema.safeParse(
      typeof message === 'object' && message !== null && 'status' in message
        ? (message as { status: unknown }).status
        : undefined,
    )
    if (parsed.success) input.status.update(parsed.data)
  })
  worker.on('error', (error) => {
    input.status.update({
      ...input.status.current(),
      phase: 'failed',
      failure: String(error),
    })
  })
  receive((event) => {
    if (event.type === 'Refresh') worker.postMessage('Refresh')
  })
  return () => {
    void worker.terminate()
  }
})
