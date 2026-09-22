import { driveSessionError } from '@/domains/sessions/contract/ipc/contract'
import type { SessionSource } from '@/domains/sessions/main/observation/reader/session-source'
import type {
  SessionAdapter,
  SessionProjection,
} from '@/domains/sessions/next/contract/session-projection-contract'
import {
  discovery,
  mergedProjections,
  rosterRowOf,
  rowsOf,
} from '@/harnesses/codex/observation/codex-history-rows'

export function createCodexAppServerSessionSource(options: {
  projections: () => readonly SessionProjection[]
  watchedProjections: () => readonly SessionProjection[]
  refreshHistory: () => Promise<readonly SessionProjection[]>
  checkoutFor: (nativeId: string) => string | null
  adapter: SessionAdapter
}): SessionSource & Required<Pick<SessionSource, 'rename'>> {
  const projectionFor = (sessionId: string) =>
    mergedProjections(options.watchedProjections(), options.projections()).find(
      (projection) => projection.session.nativeId === sessionId,
    ) ?? null
  return {
    harness: 'codex',
    discoverSessions: async () => {
      const stored = await options.refreshHistory()
      return discovery(mergedProjections(stored, options.projections()), options.checkoutFor)
    },
    managedSessions: () =>
      options
        .projections()
        .map((projection) =>
          rosterRowOf(projection, options.checkoutFor(projection.session.nativeId)),
        ),
    readSessionFiles: async () => null,
    readManagedFeed: (sessionId) => {
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
