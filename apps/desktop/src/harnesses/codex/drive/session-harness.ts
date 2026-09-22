// This harness's registration (#2488): its own driver, Session source, drive adapter, watched
// transcript root and lifecycle callbacks, in the one declared shape shared Session composition
// iterates. No file outside `harnesses/codex` names this driver's shape.
import path from 'node:path'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/domains/sessions/contract/proof-protocol'
import { attachCodexCompactionBridge } from '@/harnesses/codex/compaction/bridge'
import { renameCodexSession } from '@/harnesses/codex/drive/rename-session'
import { createCodexDriveAdapter } from '@/harnesses/codex/drive/session-drive-adapter'
import { createSystemCodexSessionDriver } from '@/harnesses/codex/drive/system-codex-session-driver'
import { codexTranscriptsRoot } from '@/harnesses/codex/sessions/roots'
import { codexTranscriptSource } from '@/harnesses/codex/sessions/transcript-source'
import type { HarnessRegistration } from '@/harnesses/composition/harness-registration'

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
