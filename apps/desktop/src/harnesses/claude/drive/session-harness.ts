// This harness's registration (#2488): its own driver, Session source, drive adapter, watched
// transcript root and lifecycle callbacks, in the one declared shape shared Session composition
// iterates. No file outside `harnesses/claude` names this driver's shape.
import path from 'node:path'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import { installCompactionHook } from '@/harnesses/claude/compaction/compaction-hook'
import { renameClaudeSession } from '@/harnesses/claude/drive/rename-session'
import { createClaudeDriveAdapter } from '@/harnesses/claude/drive/session-drive-adapter'
import { createSystemClaudeSessionDriver } from '@/harnesses/claude/drive/system-claude-session-driver'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'
import {
  claudeCompactionStartsRoot,
  claudeProcessesRoot,
  claudeSettingsPath,
  claudeTranscriptsRoot,
} from '@/harnesses/claude/sessions/roots'
import type { HarnessRegistration } from '@/harnesses/composition/harness-registration'

export const claudeHarness: HarnessRegistration = {
  harness: 'claude',
  start({ userData, home, proofEnabled, acceptance, index }) {
    const claude = createSystemClaudeSessionDriver({
      permissions: path.join(userData, 'claude-permission-plugins'),
      ledger: path.join(userData, 'claude-session-ownership.json'),
      transcripts: claudeTranscriptsRoot(home),
      handoffBriefs: path.join(userData, 'claude-session-handoffs'),
      handoffLedger: path.join(userData, 'claude-session-handoffs.json'),
      executable: proofEnabled ? process.env[SESSION_CLAUDE_EXECUTABLE_ENV] : undefined,
    })
    const compactionStarts =
      proofEnabled || acceptance ? undefined : claudeCompactionStartsRoot(home)
    if (compactionStarts !== undefined) {
      installCompactionHook(claudeSettingsPath(home), compactionStarts)
        .then((install) => {
          if (install === 'refused')
            console.warn(
              'Claude settings could not be read, so compactions stay hidden until they end',
            )
        })
        .catch((error) => console.error('Claude compaction hook failed to install', error))
    }
    return {
      harness: 'claude',
      source: claudeSessionSource({
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
      }),
      driveAdapter: createClaudeDriveAdapter(claude),
      watchedTranscriptRoots: [claudeTranscriptsRoot(home)],
      close: () => claude.close(),
      onPermissionsChanged: claude.onPermissionsChanged,
    }
  },
}
