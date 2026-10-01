// What a Claude CLI wrote, read back through the Agent SDK's own reader rather than its files.
import process from 'node:process'
import {
  getSessionMessages,
  listSessions,
  type SDKSessionInfo,
  type SessionMessage,
} from '@anthropic-ai/claude-agent-sdk'

// The SDK reads `CLAUDE_CONFIG_DIR` on each call, so a read points it at the given folder.
async function inConfigDirectory<T>(configDirectory: string, read: () => Promise<T>): Promise<T> {
  const previous = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = configDirectory
  try {
    return await read()
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = previous
  }
}

export function claudeSessionMessages(
  configDirectory: string,
  sessionId: string,
): Promise<SessionMessage[]> {
  return inConfigDirectory(configDirectory, () => getSessionMessages(sessionId))
}

// Argo starts its Sessions through the SDK, which marks them programmatic.
export function claudeSessions(configDirectory: string): Promise<SDKSessionInfo[]> {
  return inConfigDirectory(configDirectory, () => listSessions({ includeProgrammatic: true }))
}
