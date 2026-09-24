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
      discoverLaunch: async (intent) => {
        const workspaces = await runtime.knownWorkspaces()
        const cwd = workspaces.find((workspace) => workspace.id === intent.workspaceId)?.path
        if (cwd === undefined) return { kind: 'unavailable' }
        try {
          const sessions = await listSessions({ dir: cwd, includeWorktrees: false })
          const matches = sessions.filter(
            (session) =>
              session.cwd === cwd &&
              session.firstPrompt === intent.prompt &&
              session.createdAt !== undefined &&
              session.createdAt >= intent.createdAt - 120_000,
          )
          return matches.length === 1 && matches[0] !== undefined
            ? { kind: 'found', nativeId: matches[0].sessionId }
            : { kind: 'ambiguous' }
        } catch {
          return { kind: 'unavailable' }
        }
      },
    }
  },
}
