import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { createClaudeSdkHistorySource } from './claude-sdk-history-source'
import { createClaudeSessionAdapter } from './claude-session-adapter'

export const claudeSessionAdapterRegistration: SessionAdapterRegistration = {
  harness: 'claude',
  create: (runtime) => {
    const adapter = createClaudeSessionAdapter(runtime)
    return {
      adapter,
      close: adapter.close,
      source: createClaudeSdkHistorySource({ managedSessions: adapter.roster }),
    }
  },
}
