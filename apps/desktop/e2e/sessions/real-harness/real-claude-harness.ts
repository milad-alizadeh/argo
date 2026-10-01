import path from 'node:path'
import type { SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import { decodeClaudeSessionMessages } from '@/harnesses/claude/session/claude-session-history'
import { claudeSessionMessages, claudeSessions } from '../../../mocks/cli/claude/claude-sdk-reader'
import type { VendorHistoryReader } from './real-session-transcript'

function openClaudeVendorReader(home: string): VendorHistoryReader<SessionMessage[]> {
  const configDirectory = path.join(home, '.claude')
  const records = (sessionId: string) => claudeSessionMessages(configDirectory, sessionId)
  return {
    sessionIds: async () =>
      (await claudeSessions(configDirectory)).map((session) => session.sessionId),
    records,
    content: async (sessionId) => decodeClaudeSessionMessages(await records(sessionId)),
    close: () => {},
  }
}

export const realClaudeCli = {
  authentication: ['auth', 'status'],
  credential: ['.claude.json'],
  // The login token lives in the macOS login Keychain, which `security` finds under HOME (#2353).
  linked: [['Library', 'Keychains']],
  label: 'Claude',
  transcripts: (home: string) => path.join(home, '.claude', 'projects'),
  openReader: async (home: string, _executable: string) => openClaudeVendorReader(home),
}
