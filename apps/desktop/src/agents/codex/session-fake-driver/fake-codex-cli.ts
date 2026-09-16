// The Codex adapter's own answers about its fake (#2308). The fake app-server completes a Turn
// without a message of its own, so the mark a case waits for is the prompt the Turn carried, and
// the rollouts land under the transcript root itself.
import type { FakeCli } from '../../../core/sessions/fake-driver/fake-cli'
import { writeFakeCodex } from './fixture-driver'

export const fakeCodexCli: FakeCli = {
  write: (root) => writeFakeCodex(root),
  folder: (transcripts) => transcripts,
  replyMark: (prompt) => prompt,
}
