// Every harness Session wiring knows about (#2488). A new harness is a new entry here, with its
// own module beside its adapter (`agents/<cli>/drive/session-harness.ts`) — no other shared
// Session file names a `cli`.
import { claudeHarness } from '@/agents/claude/drive/session-harness'
import { codexHarness } from '@/agents/codex/drive/session-harness'
import type { HarnessRegistration } from '@/domains/sessions/main/composition/harness-registration'

export const sessionHarnesses: readonly HarnessRegistration<unknown>[] = [
  claudeHarness,
  codexHarness,
]
