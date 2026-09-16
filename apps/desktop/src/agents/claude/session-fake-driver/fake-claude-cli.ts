// The Claude adapter's own answers about its fake (#2308): where the executable goes, where the
// transcripts land, and the words the fake answers a prompt with.
import type { FakeCli } from '../../../core/sessions/fake-driver/fake-cli'
import { fakeClaudeFolder } from './fake-claude-transcripts'
import { writeFakeClaude } from './session-resume-case'

export const fakeClaudeCli: FakeCli = {
  write: (root, transcripts) => writeFakeClaude(root, transcripts),
  folder: fakeClaudeFolder,
  replyMark: (prompt) => `Fake Claude read: ${prompt}`,
}
