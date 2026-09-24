import { type ActorRefFrom, fromPromise } from 'xstate'
import { indexSessionsInWorker } from '@/domains/sessions/main/sync/session-index-worker-client'
import {
  type SessionSyncJobInput,
  type SessionSyncResult,
  sessionSyncPageSize,
} from '@/domains/sessions/main/sync/session-sync-machine'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '../app-server/codex-app-server-machine'
import { readCodexSessions } from './codex-discovery'

export function createCodexSessionSync(databasePath: string) {
  return fromPromise<SessionSyncResult, SessionSyncJobInput>(async ({ input, signal, system }) => {
    const appServer = system.get('codex') as ActorRefFrom<typeof codexAppServerMachine> | undefined
    if (appServer === undefined) throw new Error('Codex app-server actor is unavailable.')
    const request = requestCodexAppServer(appServer)
    const result = await readCodexSessions(request, input.cursor, sessionSyncPageSize)
    if (signal.aborted) throw new Error('Codex Session sync was cancelled.')
    const indexed = await indexSessionsInWorker({
      databasePath,
      sessions: result.sessions,
      signal,
    })
    return {
      argoIds: indexed.argoIds,
      complete: result.nextCursor === null,
      cursor: result.nextCursor,
      generation: input.generation,
      indexedCount: indexed.indexedCount,
      invalidRecordCount: result.invalidRecordCount,
      page: input.page,
    }
  })
}
