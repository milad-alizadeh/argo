import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { findExecutableOnLoginShellPath } from '@/harnesses/host/executable-path'
import { claudeTranscriptsRoot, transcriptPaths } from '../transcript-files'
import { createClaudeSdkHistorySource } from './claude-sdk-history-source'
import { createClaudeSessionAdapter } from './claude-session-adapter'

export function createClaudeSessionAdapterRegistration(home: string): SessionAdapterRegistration {
  return {
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
        source: createClaudeSdkHistorySource({
          managedSessions: adapter.roster,
          countTranscriptFiles: async () =>
            (await transcriptPaths(claudeTranscriptsRoot(home))).length,
        }),
      }
    },
  }
}
