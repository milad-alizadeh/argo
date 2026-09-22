import { codexSessionSource, type ReaderOptions } from '@/harnesses/codex/sessions/read-sessions'
import { codexStatePath } from '@/harnesses/codex/sessions/roots'
import { codexThreadNames } from '@/harnesses/codex/sessions/state-store'

// Codex Desktop's thread names live beside the rollouts (ADR-0042). Both Codex sources read them.
export function codexTranscriptSource(
  transcripts: string,
  options: Omit<ReaderOptions, 'threadNames'> = {},
) {
  return codexSessionSource(transcripts, {
    ...options,
    threadNames: codexThreadNames(codexStatePath(transcripts)),
  })
}
