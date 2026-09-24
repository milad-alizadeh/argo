import path from 'node:path'
import { parseTranscriptLine } from '@/harnesses/claude/transcript'
import { assistantAfterPrompt, createTranscriptMatcher } from './real-session-transcript'

export const realClaudeCli = {
  authentication: ['auth', 'status'],
  credential: ['.claude.json'],
  // The login token lives in the macOS login Keychain, which `security` finds under HOME (#2353).
  linked: [['Library', 'Keychains']],
  label: 'Claude',
  transcripts: (home: string) => path.join(home, '.claude', 'projects'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, createTranscriptMatcher(parseTranscriptLine)),
}
