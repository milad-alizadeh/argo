import { fromPromise } from 'xstate'
import { discoverClaudeSessionsInWorker } from '@/domains/sessions/main/sync/session-index-worker-client'
import {
  type SessionSyncJobInput,
  type SessionSyncResult,
  sessionSyncPageSize,
} from '@/domains/sessions/main/sync/session-sync-machine'

export function createClaudeSessionSync(databasePath: string) {
  return fromPromise<SessionSyncResult, SessionSyncJobInput>(async ({ input, signal }) => {
    const result = await discoverClaudeSessionsInWorker({
      databasePath,
      limit: sessionSyncPageSize,
      offset: input.page * sessionSyncPageSize,
      signal,
    })
    return {
      argoIds: result.argoIds,
      complete: result.complete,
      cursor: null,
      generation: input.generation,
      indexedCount: result.indexedCount,
      invalidRecordCount: result.invalidRecordCount,
      page: input.page,
    }
  })
}
