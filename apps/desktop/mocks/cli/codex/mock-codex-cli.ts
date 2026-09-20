// The Codex adapter's own answers about its mock (#2308). The mock app-server completes a Turn
// without a message of its own, so the mark a case waits for is the prompt the Turn carried, and
// the rollouts land under the transcript root itself.
import type { MockHarness } from '../mock-cli'
import { writeMockCodex } from './mock-codex-driver'

export const mockCodexHarness: MockHarness = {
  write: writeMockCodex,
  folder: (transcripts) => transcripts,
  replyMark: (prompt) => prompt,
}
