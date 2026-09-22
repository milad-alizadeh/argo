// This harness's registration (#2488): its own driver, Session source, drive adapter, watched
// transcript root and lifecycle callbacks, in the one declared shape shared Session composition
// iterates. No file outside `harnesses/codex` names this driver's shape.
import path from 'node:path'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import type { HarnessRegistration } from '@/harnesses/composition/harness-registration'
import { attachCodexCompactionBridge } from '../../compaction/bridge'
import { codexTranscriptsRoot } from '../../sessions/discovery/roots'
import { codexTranscriptSource } from '../../sessions/discovery/transcript-source'
import { renameCodexSession } from '../rename-session'
import { createCodexDriveAdapter } from './session-drive-adapter'
import { createSystemCodexSessionDriver } from './system-codex-session-driver'

export const codexHarness: HarnessRegistration = {
  harness: 'codex',
  start({ userData, home, proofEnabled, index, managedRosterChanges }) {
    const codex = createSystemCodexSessionDriver({
      executable: proofEnabled ? process.env[SESSION_CODEX_EXECUTABLE_ENV] : undefined,
      ownership: path.join(userData, 'codex-session-ownership.json'),
      transcripts: codexTranscriptsRoot(home),
    })
    const transcripts = codexTranscriptsRoot(home)
    return {
      harness: 'codex',
      source: codexTranscriptSource(transcripts, {
        roster: codex.roster,
        liveMessages: codex.liveMessages,
        pendingQuestion: codex.pendingQuestion,
        rename: (request) => renameCodexSession(request, codex),
        isLockedElsewhere: codex.isLockedElsewhere,
        index,
      }),
      driveAdapter: createCodexDriveAdapter(codex),
      watchedTranscriptRoots: [transcripts],
      close: () => Promise.resolve(codex.close()),
      onRosterChanged: managedRosterChanges?.[codexHarness.harness] ?? codex.onRosterChanged,
      attachSettingsBridge: attachCodexCompactionBridge,
    }
  },
}
