// The two system drivers and the adapters over them, split out of `bridges.ts` to stay under the
// per-file line cap. A driver holds the live CLI; an adapter is the one shape shared code calls
// (ADR-0024).
import path from 'node:path'
import { createClaudeDriveAdapter } from './agents/claude/drive/session-drive-adapter'
import { createSystemClaudeSessionDriver } from './agents/claude/drive/system-claude-session-driver'
import { claudeTranscriptsRoot } from './agents/claude/sessions/roots'
import { createCodexDriveAdapter } from './agents/codex/drive/session-drive-adapter'
import { createSystemCodexSessionDriver } from './agents/codex/drive/system-codex-session-driver'
import { codexTranscriptsRoot } from './agents/codex/sessions/roots'
import {
  SESSION_CLAUDE_EXECUTABLE_ENV,
  SESSION_CODEX_EXECUTABLE_ENV,
} from './core/sessions/proof-protocol'
import type { SessionDriveAdapters } from './core/sessions/session-drive-adapter'

export function createSessionDrivers(userData: string, home: string, proofEnabled: boolean) {
  const claude = createSystemClaudeSessionDriver({
    permissions: path.join(userData, 'claude-permission-plugins'),
    ledger: path.join(userData, 'claude-session-ownership.json'),
    transcripts: claudeTranscriptsRoot(home),
    handoffBriefs: path.join(userData, 'claude-session-handoffs'),
    handoffLedger: path.join(userData, 'claude-session-handoffs.json'),
    executable: proofEnabled ? process.env[SESSION_CLAUDE_EXECUTABLE_ENV] : undefined,
  })
  const codex = createSystemCodexSessionDriver({
    executable: proofEnabled ? process.env[SESSION_CODEX_EXECUTABLE_ENV] : undefined,
    ownership: path.join(userData, 'codex-session-ownership.json'),
    transcripts: codexTranscriptsRoot(home),
  })
  return { claude, codex }
}

export type SessionDrivers = ReturnType<typeof createSessionDrivers>

export function createSessionAdapters(drivers: SessionDrivers): SessionDriveAdapters {
  return {
    claude: createClaudeDriveAdapter(drivers.claude),
    codex: createCodexDriveAdapter(drivers.codex),
  }
}
