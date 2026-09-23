import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { createClaudeSdkHistorySource } from './claude-sdk-history-source'
import { createClaudeSessionAdapter } from './claude-session-adapter'

export function createClaudeSessionAdapterRegistration(
  countTranscriptFiles: () => Promise<number>,
): SessionAdapterRegistration {
  return {
    harness: 'claude',
    create: (runtime) => {
      const adapter = createClaudeSessionAdapter(runtime)
      return {
        adapter,
        close: adapter.close,
        source: createClaudeSdkHistorySource({
          managedSessions: adapter.roster,
          countTranscriptFiles,
        }),
      }
    },
  }
}
