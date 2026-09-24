import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { createCodexSessionAdapter } from './codex-session-adapter'

export function createCodexSessionAdapterRegistration(options: {
  findExecutable: () => string | null
  transcriptsRoot: string
  knownWorkspaces: () => Promise<readonly { id: string; path: string }[]>
}): SessionAdapterRegistration {
  return {
    harness: 'codex',
    create: (runtime) => {
      const adapter = createCodexSessionAdapter({
        findExecutable: options.findExecutable,
        sessionService: runtime.sessionService,
        waitForWorkspaceReady: runtime.waitForWorkspaceReady,
        now: runtime.now,
        resolveWorkspace: runtime.resolveWorkspace,
        knownWorkspaces: options.knownWorkspaces,
        transcriptsRoot: options.transcriptsRoot,
      })
      return {
        adapter,
        readModelCatalog: adapter.readModelCatalog,
        close: adapter.close,
        hasLiveChannel: (session) =>
          adapter
            .projections()
            .some(
              (projection) =>
                projection.session.nativeId === session.nativeId &&
                projection.posture === 'managed',
            ),
        readKnownSession: async (session) => {
          try {
            const found = await adapter.readHistoryProjection(session.nativeId)
            return found?.session.nativeId === session.nativeId
              ? { kind: 'found' }
              : { kind: 'ambiguous' }
          } catch {
            return { kind: 'temporarily-unavailable' }
          }
        },
        discoverLaunch: async (intent) => {
          try {
            const sessions = await adapter.refreshHistory(() => false)
            const matches = sessions.filter((session) => {
              const firstTurn = session.turns[0]
              const firstUserMessage = session.messages.find((message) => message.role === 'user')
              return (
                session.workspace?.id === intent.workspaceId &&
                firstUserMessage?.text === intent.prompt &&
                firstTurn !== undefined &&
                firstTurn.startedAt >= intent.createdAt - 120_000
              )
            })
            return matches.length === 1 && matches[0] !== undefined
              ? { kind: 'found', nativeId: matches[0].session.nativeId }
              : { kind: 'ambiguous' }
          } catch {
            return { kind: 'unavailable' }
          }
        },
      }
    },
  }
}
