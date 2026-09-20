// Both CLI adapters' `SessionSource`s, wired to their drivers and the app's shared Session index.
// Split from `session-bridges.ts` to keep that composition root short.
import { renameClaudeSession } from '@/agents/claude/drive/rename-session'
import { claudeSessionSource } from '@/agents/claude/sessions/read-sessions'
import { claudeProcessesRoot, claudeTranscriptsRoot } from '@/agents/claude/sessions/roots'
import { renameCodexSession } from '@/agents/codex/drive/rename-session'
import { codexSessionSource } from '@/agents/codex/sessions/read-sessions'
import { codexStatePath, codexTranscriptsRoot } from '@/agents/codex/sessions/roots'
import { codexThreadNames } from '@/agents/codex/sessions/state-store'
import type { createSessionDrivers } from '@/domains/sessions/main/composition/session-bridges'
import type { openSessionIndexOrNone } from '@/domains/sessions/main/index/session-index/open-index'

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
