import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { createClaudeSdkHistorySource } from './claude-sdk-history-source'
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
      source: createClaudeSdkHistorySource({ managedSessions: adapter.roster }),
    }
  },
}
