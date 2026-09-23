// This harness's registration (#2488): its own driver, Session source, drive adapter, watched
// transcript root and lifecycle callbacks, in the one declared shape shared Session composition
// iterates. No file outside `harnesses/claude` names this driver's shape.
import path from 'node:path'
import { SESSION_CLAUDE_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import type { HarnessRegistration } from '@/harnesses/composition/harness-registration'
import { createClaudeSdkHistorySource } from '../agent-sdk/claude-sdk-history-source'
import { installCompactionHook } from '../compaction/compaction-hook'
import { claudeSessionSource } from '../sessions/discovery/read-sessions'
import { claudeCompactionStartsRoot, claudeSettingsPath } from '../sessions/discovery/roots'
import { claudeTranscriptsRoot, transcriptPaths } from '../transcript-files'
import { renameClaudeSession } from './rename-session'
import { createClaudeDriveAdapter } from './session-drive-adapter'
import { createSystemClaudeSessionDriver } from './system-claude-session-driver'

export const claudeHarness: HarnessRegistration = {
  harness: 'claude',
  start({ userData, home, proofEnabled, acceptance, managedRosterChanges }) {
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
      source: proofEnabled
        ? claudeSessionSource({
            transcripts: claudeTranscriptsRoot(home),
            managedSessions: claude.roster,
            liveMessages: claude.liveMessages,
            rename: (request) => renameClaudeSession(request, claude),
          })
        : createClaudeSdkHistorySource({
            countTranscriptFiles: async () =>
              (await transcriptPaths(claudeTranscriptsRoot(home))).length,
          }),
      driveAdapter: createClaudeDriveAdapter(claude),
      onboardingDriver: claude,
      watchedTranscriptRoots: [claudeTranscriptsRoot(home)],
      close: () => claude.close(),
      onPermissionsChanged: proofEnabled
        ? claude.onPermissionsChanged
        : (managedRosterChanges?.[claudeHarness.harness] ?? claude.onPermissionsChanged),
      onRosterChanged: proofEnabled ? undefined : managedRosterChanges?.[claudeHarness.harness],
    }
  },
}
