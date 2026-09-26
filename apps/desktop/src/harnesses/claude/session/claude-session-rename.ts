import { renameSession } from '@anthropic-ai/claude-agent-sdk'

export const claudeSessionRenamer = {
  rename: (nativeId: string, title: string) => renameSession(nativeId, title),
}
