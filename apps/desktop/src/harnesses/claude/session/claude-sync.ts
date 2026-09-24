import { fromPromise } from 'xstate'
import {
  type SessionSyncJobInput,
  type SessionSyncResult,
  sessionSyncPageSize,
} from '@/domains/sessions/main/sync/session-sync-machine'
import { readClaudeSessions } from './claude-discovery'

export const claudeSessionSync = fromPromise<SessionSyncResult, SessionSyncJobInput>(
  async ({ input, signal }) => {
    const result = await readClaudeSessions({
      limit: sessionSyncPageSize,
      offset: input.page * sessionSyncPageSize,
    })
    if (signal.aborted) throw new Error('Claude Session sync was cancelled.')
    return {
      complete: result.recordCount < sessionSyncPageSize,
      cursor: null,
      generation: input.generation,
      indexedCount: result.sessions.length,
      invalidRecordCount: result.invalidRecordCount,
      page: input.page,
      sessions: result.sessions,
    }
  },
)
