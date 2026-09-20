// This harness's registration (#2488): its own driver, Session source, drive adapter, watched
// transcript root and lifecycle callbacks, in the one declared shape shared Session composition
// iterates. No file outside `harnesses/claude` names this driver's shape.
import path from 'node:path'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/domains/sessions/main/composition/proof-protocol'
import { renameClaudeSession } from '@/harnesses/claude/drive/rename-session'
import { createClaudeDriveAdapter } from '@/harnesses/claude/drive/session-drive-adapter'
import { createSystemClaudeSessionDriver } from '@/harnesses/claude/drive/system-claude-session-driver'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'
import { claudeProcessesRoot, claudeTranscriptsRoot } from '@/harnesses/claude/sessions/roots'
import type { HarnessRegistration } from '@/harnesses/composition/harness-registration'

type ClaudeDriver = ReturnType<typeof createSystemClaudeSessionDriver>

export const claudeHarness: HarnessRegistration<ClaudeDriver> = {
  harness: 'claude',
  createDriver({ userData, home, proofEnabled }) {
    return createSystemClaudeSessionDriver({
      permissions: path.join(userData, 'claude-permission-plugins'),
      ledger: path.join(userData, 'claude-session-ownership.json'),
      transcripts: claudeTranscriptsRoot(home),
      handoffBriefs: path.join(userData, 'claude-session-handoffs'),
      handoffLedger: path.join(userData, 'claude-session-handoffs.json'),
      executable: proofEnabled ? process.env[SESSION_CLAUDE_EXECUTABLE_ENV] : undefined,
    })
  },
  createSource(claude, { home, compactionStarts, index }) {
    return claudeSessionSource({
      transcripts: claudeTranscriptsRoot(home),
      processes: claudeProcessesRoot(home),
      managedSessions: claude.roster,
      compactionStarts,
      beginCompaction: claude.beginCompaction,
      completeCompaction: claude.completeCompaction,
      completeHandoffs: claude.completeHandoffs,
      handoffEdges: claude.handoffEdges,
      liveMessages: claude.liveMessages,
      rename: (request) => renameClaudeSession(request, claude),
      isLockedElsewhere: claude.isLockedElsewhere,
      index,
    })
  },
  createDriveAdapter(claude) {
    return createClaudeDriveAdapter(claude)
  },
  watchedTranscriptRoots(home) {
    return [claudeTranscriptsRoot(home)]
  },
  closeDriver(claude) {
    return claude.close()
  },
  onPermissionsChanged(claude) {
    return claude.onPermissionsChanged
  },
}
