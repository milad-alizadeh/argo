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
        discoverSessions: async () => {
          const sessions = await adapter.refreshHistory(() => false)
          return sessions.flatMap((session) =>
            session.workspace?.id === undefined
              ? []
              : [
                  {
                    harness: 'codex' as const,
                    nativeId: session.session.nativeId,
                    workspaceId: session.workspace.id,
                    firstPrompt:
                      session.messages.find((message) => message.role === 'user')?.text ?? null,
                  },
                ],
          )
        },
      }
    },
  }
}
