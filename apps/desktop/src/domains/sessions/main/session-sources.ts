// Both CLI adapters' `SessionSource`s, wired to their drivers and the app's shared Session index.
// Split from `session-bridges.ts` to keep that composition root short.

import type { createSessionDrivers } from '@/domains/sessions/main/session-bridges'
import type { openSessionIndexOrNone } from '@/domains/sessions/main/session-index/open-index'
import { renameClaudeSession } from '@/harnesses/claude/drive/rename-session'
import { claudeSessionSource } from '@/harnesses/claude/sessions/read-sessions'
import { claudeProcessesRoot, claudeTranscriptsRoot } from '@/harnesses/claude/sessions/roots'
import { renameCodexSession } from '@/harnesses/codex/drive/rename-session'
import { codexSessionSource } from '@/harnesses/codex/sessions/read-sessions'
import { codexStatePath, codexTranscriptsRoot } from '@/harnesses/codex/sessions/roots'
import { codexThreadNames } from '@/harnesses/codex/sessions/state-store'

type SessionSourcesOptions = {
  home: string
  drivers: ReturnType<typeof createSessionDrivers>
  compactionStarts: string | undefined
  index: ReturnType<typeof openSessionIndexOrNone>
}

export function sessionSources({ home, drivers, compactionStarts, index }: SessionSourcesOptions) {
  const { claude, codex } = drivers
  return [
    claudeSessionSource({
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
    codexSessionSource(codexTranscriptsRoot(home), {
      roster: codex.roster,
      liveMessages: codex.liveMessages,
      pendingQuestion: codex.pendingQuestion,
      rename: (request) => renameCodexSession(request, codex),
      isLockedElsewhere: codex.isLockedElsewhere,
      threadNames: codexThreadNames(codexStatePath(codexTranscriptsRoot(home))),
      index,
    }),
  ]
}
