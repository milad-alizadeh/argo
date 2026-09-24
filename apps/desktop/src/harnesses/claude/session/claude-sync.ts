import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { fromPromise } from 'xstate'
import { runSessionIndexWorker } from '@/domains/sessions/main/sync/session-index-worker-client'
import {
  type SessionSyncJobInput,
  type SessionSyncResult,
  sessionSyncPageSize,
} from '@/domains/sessions/main/sync/session-sync-machine'

export function createClaudeSessionSync(databasePath: string) {
  return fromPromise<SessionSyncResult, SessionSyncJobInput>(async ({ input, signal }) => {
    const offset = input.cursor === null ? 0 : Number(input.cursor)
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid Claude cursor.')
    const result = await runSessionIndexWorker(
      new Worker(path.join(__dirname, 'claude-sync-worker.js'), {
        name: 'claude-session-sync',
      }),
      {
        databasePath,
        limit: sessionSyncPageSize,
        offset,
        priorityNativeId: input.priorityNativeId,
      },
      signal,
    )
    return {
      cursor: result.cursor,
      generation: input.generation,
      indexedCount: result.indexedCount,
      invalidRecordCount: result.invalidRecordCount,
    }
  })
}
