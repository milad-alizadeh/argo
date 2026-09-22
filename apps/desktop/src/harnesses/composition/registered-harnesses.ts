// Every harness Session wiring knows about (#2488). A new harness is a new entry here, with its
// own module beside its adapter (`harnesses/<name>/drive/session-harness.ts`) — no other shared
// Session file names a `harness`.
import { claudeHarness } from '@/harnesses/claude/drive'
import { codexHarness } from '@/harnesses/codex/drive'
import type { HarnessRegistration } from './harness-registration'

export const sessionHarnesses: readonly HarnessRegistration[] = [claudeHarness, codexHarness]
