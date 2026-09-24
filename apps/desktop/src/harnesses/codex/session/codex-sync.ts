import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { type ActorRefFrom, fromPromise } from 'xstate'
import { z } from 'zod'
import { runSessionIndexWorker } from '@/domains/sessions/main/sync/session-index-worker-client'
import {
  type SessionSyncJobInput,
  type SessionSyncResult,
  sessionSyncPageSize,
} from '@/domains/sessions/main/sync/session-sync-machine'
import {
  type codexAppServerMachine,
  requestCodexAppServer,
} from '../app-server/codex-app-server-machine'
import { readCodexSessionPage } from './codex-discovery'

export function createCodexSessionSync(databasePath: string) {
  return fromPromise<SessionSyncResult, SessionSyncJobInput>(async ({ input, signal, system }) => {
    const appServer = system.get('codex') as ActorRefFrom<typeof codexAppServerMachine> | undefined
    if (appServer === undefined) throw new Error('Codex app-server actor is unavailable.')
    const request = requestCodexAppServer(appServer)
    const page =
      input.priorityNativeId === null
        ? await readCodexSessionPage(request, input.cursor, sessionSyncPageSize)
        : await request(
            'thread/read',
            { threadId: input.priorityNativeId, includeTurns: false },
            (value) => {
              const result = z.object({ thread: z.unknown() }).parse(value)
              return { data: [result.thread], nextCursor: null }
            },
          )
    if (signal.aborted) throw new Error('Codex Session sync was cancelled.')
    const indexed = await runSessionIndexWorker(
      new Worker(path.join(__dirname, 'codex-sync-worker.js'), {
        name: 'codex-session-sync',
      }),
      { databasePath, page, priorityNativeId: input.priorityNativeId },
      signal,
    )
    return {
      cursor: indexed.cursor,
      generation: input.generation,
      indexedCount: indexed.indexedCount,
      invalidRecordCount: indexed.invalidRecordCount,
    }
  })
}
