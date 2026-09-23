import { driveSessionError } from '@/domains/sessions/contract/ipc/contract'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import type {
  SessionAdapter,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import { discovery, mergedProjections, rosterRowOf, rowsOf } from './codex-history-rows'

const APP_SERVER_HISTORY_BUDGET_MS = 200

async function refreshWithinBudget(
  refreshHistory: () => Promise<readonly SessionProjection[]>,
): Promise<readonly SessionProjection[]> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      refreshHistory(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Codex app-server history did not answer.')),
          APP_SERVER_HISTORY_BUDGET_MS,
        )
      }),
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}

export function createCodexAppServerSessionSource(options: {
  projections: () => readonly SessionProjection[]
  watchedProjections: () => readonly SessionProjection[]
  refreshHistory: () => Promise<readonly SessionProjection[]>
  checkoutFor: (nativeId: string) => string | null
  adapter: SessionAdapter
  fallback?: SessionSource
}): SessionSource & Required<Pick<SessionSource, 'rename'>> {
  let readingFallback = false
  const projectionFor = (sessionId: string) =>
    mergedProjections(options.watchedProjections(), options.projections()).find(
      (projection) => projection.session.nativeId === sessionId,
    ) ?? null
  return {
    harness: 'codex',
    discoverSessions: async (request) => {
      try {
        const stored = await refreshWithinBudget(options.refreshHistory)
        readingFallback = false
        return discovery(mergedProjections(stored, options.projections()), options.checkoutFor)
      } catch (error) {
        if (options.fallback === undefined) throw error
        readingFallback = true
        return options.fallback.discoverSessions(request)
      }
    },
    readSessionFiles: (sessionId) =>
      options.fallback?.readSessionFiles(sessionId) ?? Promise.resolve(null),
    managedSessions: () =>
      options
        .projections()
        .map((projection) =>
          rosterRowOf(projection, options.checkoutFor(projection.session.nativeId)),
        ),
    readManagedFeed: (sessionId) => {
      if (readingFallback) return undefined
      const projection = projectionFor(sessionId)
      if (projection === null) return null
      return {
        chainId: projection.session.nativeId,
        revision: String(projection.revision),
        rows: rowsOf(projection),
      }
    },
    readShellOutput: async () => ({ state: 'absent' }),
    rename: async (request) => {
      const outcome = await options.adapter.execute({
        type: 'session.rename',
        session: { harness: 'codex', nativeId: request.sessionId },
        title: request.name,
      })
      return outcome.kind === 'accepted'
        ? {
            version: 1,
            type: 'session.renamed',
            requestId: request.requestId,
            sessionId: request.sessionId,
            title: request.name,
          }
        : driveSessionError('not-drivable', 'codex', request.requestId)
    },
  }
}
