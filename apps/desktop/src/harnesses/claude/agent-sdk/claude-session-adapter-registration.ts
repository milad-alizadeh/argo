import type { SessionAdapterRegistration } from '@/domains/sessions/next/main/session-adapter-registry'
import { createClaudeSessionAdapter } from '@/harnesses/claude/agent-sdk/claude-session-adapter'

export const claudeSessionAdapterRegistration: SessionAdapterRegistration = {
  harness: 'claude',
  create: (runtime) => {
    const adapter = createClaudeSessionAdapter(runtime)
    return { adapter, close: adapter.close }
  },
}
