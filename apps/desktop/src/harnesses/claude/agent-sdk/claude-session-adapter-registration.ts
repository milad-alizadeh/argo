import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { claudeTranscriptsRoot, transcriptPaths } from '../transcript-files'
import { createClaudeSdkHistorySource } from './claude-sdk-history-source'
import { createClaudeSessionAdapter } from './claude-session-adapter'

export function createClaudeSessionAdapterRegistration(home: string): SessionAdapterRegistration {
  return {
    harness: 'claude',
    create: (runtime) => {
      const adapter = createClaudeSessionAdapter(runtime)
      return {
        adapter,
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
