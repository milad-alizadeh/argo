import { getSessionInfo, listSessions } from '@anthropic-ai/claude-agent-sdk'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { createClaudeSessionAdapter } from './claude-session-adapter'

export const claudeSessionAdapterRegistration: SessionAdapterRegistration = {
  harness: 'claude',
  create: (runtime) => {
    const adapter = createClaudeSessionAdapter({
      ...runtime,
      findExecutablePath: () =>
        process.env[SESSION_CLAUDE_EXECUTABLE_ENV] ?? findExecutableOnLoginShellPath('claude'),
    })
    return {
      adapter,
      readClaudeModelCatalog: adapter.readModelCatalog,
      close: adapter.close,
      hasLiveChannel: (session) => adapter.projection(session)?.posture === 'managed',
      readKnownSession: async (session) => {
        try {
          const found = await getSessionInfo(session.nativeId)
          return found?.sessionId === session.nativeId ? { kind: 'found' } : { kind: 'ambiguous' }
        } catch {
          return { kind: 'temporarily-unavailable' }
        }
      },
      discoverSessions: async () => {
        const workspaces = await runtime.knownWorkspaces()
        const results = await Promise.allSettled(
          workspaces.map(async (workspace) => {
            const sessions = await listSessions({ dir: workspace.path, includeWorktrees: false })
            return sessions.flatMap((session) =>
              session.cwd === workspace.path
                ? [
                    {
                      harness: 'claude' as const,
                      nativeId: session.sessionId,
                      workspaceId: workspace.id,
                      firstPrompt: session.firstPrompt ?? null,
                    },
                  ]
                : [],
            )
          }),
        )
        return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
      },
    }
  },
}
