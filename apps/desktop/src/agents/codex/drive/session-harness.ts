// This harness's registration (#2488): its own driver, Session source, drive adapter, watched
// transcript root and lifecycle callbacks, in the one declared shape shared Session composition
// iterates. No file outside `agents/codex` names this driver's shape.
import path from 'node:path'
import { renameCodexSession } from '@/agents/codex/drive/rename-session'
import { createCodexDriveAdapter } from '@/agents/codex/drive/session-drive-adapter'
import { createSystemCodexSessionDriver } from '@/agents/codex/drive/system-codex-session-driver'
import { codexSessionSource } from '@/agents/codex/sessions/read-sessions'
import { codexStatePath, codexTranscriptsRoot } from '@/agents/codex/sessions/roots'
import { codexThreadNames } from '@/agents/codex/sessions/state-store'
import type { HarnessRegistration } from '@/domains/sessions/main/composition/harness-registration'
import { SESSION_CODEX_EXECUTABLE_ENV } from '@/domains/sessions/main/composition/proof-protocol'

type CodexDriver = ReturnType<typeof createSystemCodexSessionDriver>

export const codexHarness: HarnessRegistration<CodexDriver> = {
  cli: 'codex',
  createDriver({ userData, home, proofEnabled }) {
    return createSystemCodexSessionDriver({
      executable: proofEnabled ? process.env[SESSION_CODEX_EXECUTABLE_ENV] : undefined,
      ownership: path.join(userData, 'codex-session-ownership.json'),
      transcripts: codexTranscriptsRoot(home),
    })
  },
  createSource(codex, { home, index }) {
    const transcripts = codexTranscriptsRoot(home)
    return codexSessionSource(transcripts, {
      roster: codex.roster,
      liveMessages: codex.liveMessages,
      pendingQuestion: codex.pendingQuestion,
      rename: (request) => renameCodexSession(request, codex),
      isLockedElsewhere: codex.isLockedElsewhere,
      threadNames: codexThreadNames(codexStatePath(transcripts)),
      index,
    })
  },
  createDriveAdapter(codex) {
    return createCodexDriveAdapter(codex)
  },
  watchedTranscriptRoots(home) {
    return [codexTranscriptsRoot(home)]
  },
  closeDriver(codex) {
    return Promise.resolve(codex.close())
  },
  onRosterChanged(codex) {
    return codex.onRosterChanged
  },
}
