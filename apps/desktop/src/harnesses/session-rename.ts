import { claudeSessionRenamer } from './claude/session/claude-session-rename'
import { codexSessionRenamer } from './codex/session/codex-session-rename'
import type { Harness } from './harness'

type SessionRenamer = {
  rename: (nativeId: string, title: string) => Promise<void>
}

const renamers = {
  claude: claudeSessionRenamer,
  codex: codexSessionRenamer,
} satisfies Record<Harness, SessionRenamer>

export function renameHarnessSession(request: {
  harness: Harness
  nativeId: string
  title: string
}): Promise<void> {
  return renamers[request.harness].rename(request.nativeId, request.title)
}
