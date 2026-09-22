import { codexSessionSource, type ReaderOptions } from './read-sessions'
import { codexStatePath } from './roots'
import { codexThreadNames } from './state-store'

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
