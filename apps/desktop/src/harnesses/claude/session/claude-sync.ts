import { fromPromise } from 'xstate'
import { indexSessionsInWorker } from '@/domains/sessions/main/sync/session-index-worker-client'
import {
  type SessionSyncJobInput,
  type SessionSyncResult,
  sessionSyncPageSize,
} from '@/domains/sessions/main/sync/session-sync-machine'
import { readClaudeSessions } from './claude-discovery'

export function createClaudeSessionSync(databasePath: string) {
  return fromPromise<SessionSyncResult, SessionSyncJobInput>(async ({ input, signal }) => {
    const result = await readClaudeSessions({
      limit: sessionSyncPageSize,
      offset: input.page * sessionSyncPageSize,
    })
    if (signal.aborted) throw new Error('Claude Session sync was cancelled.')
    const indexed = await indexSessionsInWorker({
      databasePath,
      sessions: result.sessions,
      signal,
    })
    return {
      argoIds: indexed.argoIds,
      complete: result.recordCount < sessionSyncPageSize,
      cursor: null,
      generation: input.generation,
      indexedCount: indexed.indexedCount,
      invalidRecordCount: result.invalidRecordCount,
      page: input.page,
    }
  })
}
