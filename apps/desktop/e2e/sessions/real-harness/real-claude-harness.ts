import path from 'node:path'
import process from 'node:process'
import {
  getSessionMessages,
  listSessions,
  type SessionMessage,
} from '@anthropic-ai/claude-agent-sdk'
import { decodeClaudeSessionMessages } from '@/harnesses/claude/session/claude-session-history'
import type { VendorHistoryReader } from './real-session-transcript'

// The Agent SDK reads `CLAUDE_CONFIG_DIR` on each call, so a read points it at the throwaway HOME.
async function inConfigDirectory<T>(home: string, read: () => Promise<T>): Promise<T> {
  const previous = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = path.join(home, '.claude')
  try {
    return await read()
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = previous
  }
}

function openClaudeVendorReader(home: string): VendorHistoryReader<SessionMessage[]> {
  const records = (sessionId: string) =>
    inConfigDirectory(home, () => getSessionMessages(sessionId))
  return {
    // Argo starts its Sessions through the SDK, which marks them programmatic.
    sessionIds: () =>
      inConfigDirectory(home, async () =>
        (await listSessions({ includeProgrammatic: true })).map((session) => session.sessionId),
      ),
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
