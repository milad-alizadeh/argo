import { driveSessionError } from '@/domains/sessions/contract/ipc/contract'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import { matchesSearchQuery } from '@/domains/sessions/main/projection/search/search-match'
import type {
  SessionAdapter,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import { CodexHistoryUnavailableError } from '../history/vendor-history'
import { discovery, mergedProjections, rosterRows, rowsOf } from './codex-history-rows'

const APP_SERVER_HISTORY_BUDGET_MS = 1_500

async function refreshWithinBudget(
  refreshHistory: (notifyLateSuccess: () => boolean) => Promise<readonly SessionProjection[]>,
): Promise<readonly SessionProjection[]> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const refreshed = refreshHistory(() => timedOut)
  try {
    return await Promise.race([
      refreshed,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          timedOut = true
          reject(new CodexHistoryUnavailableError('Codex app-server history did not answer.'))
        }, APP_SERVER_HISTORY_BUDGET_MS)
      }),
    ])
  } finally {
    if (timeout !== undefined) clearTimeout(timeout)
  }
}

type AppServerSourceOptions = {
  projections: () => readonly SessionProjection[]
  watchedProjections: () => readonly SessionProjection[]
  refreshHistory: (notifyLateSuccess: () => boolean) => Promise<readonly SessionProjection[]>
  refreshSearchHistory: () => Promise<readonly SessionProjection[]>
  readHistoryProjection: (sessionId: string) => Promise<SessionProjection | null>
  checkoutFor: (nativeId: string) => string | null
  adapter: SessionAdapter
}

async function readObservedProjection(options: AppServerSourceOptions, sessionId: string) {
  try {
    return await options.readHistoryProjection(sessionId)
  } catch (error) {
    const stored = await refreshWithinBudget(options.refreshHistory)
    const listed = mergedProjections(stored, options.projections()).some(
      (candidate) => candidate.session.nativeId === sessionId,
    )
    if (!listed) return null
    throw error
  }
}

export function createCodexAppServerSessionSource(
  options: AppServerSourceOptions,
): SessionSource & Required<Pick<SessionSource, 'rename'>> {
  const managedProjectionFor = (sessionId: string) =>
    options.projections().find((projection) => projection.session.nativeId === sessionId) ?? null
  return {
    harness: 'codex',
    discoverSessions: async (_request) => {
      const stored = await refreshWithinBudget(options.refreshHistory)
      return discovery(mergedProjections(stored, options.projections()), options.checkoutFor)
    },
    searchSessions: async (query) => {
      const stored = await options.refreshSearchHistory()
      return mergedProjections(stored, options.projections())
        .flatMap((projection) => rosterRows([projection], options.checkoutFor).rows)
        .filter((row) => matchesSearchQuery(row, query))
    },
    historyComplete: async () => true,
    readSessionFiles: async () => null,
    managedSessions: () => rosterRows(options.projections(), options.checkoutFor).rows,
    readManagedFeed: (sessionId) => {
      const projection = managedProjectionFor(sessionId)
      if (projection === null) return undefined
      return {
        chainId: projection.session.nativeId,
        revision: String(projection.revision),
        rows: rowsOf(projection),
      }
    },
    readObservedFeed: async (sessionId) => {
      const projection = await readObservedProjection(options, sessionId)
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
