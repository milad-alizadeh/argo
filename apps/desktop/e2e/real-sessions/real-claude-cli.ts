import path from 'node:path'
import { parseTranscriptLine } from '../../src/agents/claude/sessions/records'
import { assistantAfterPrompt, createTranscriptMatcher } from './real-session-transcript'

export const realClaudeCli = {
  authentication: ['auth', 'status'],
  credential: ['.claude.json'],
  label: 'Claude',
  transcripts: (home: string) => path.join(home, '.claude', 'projects'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, createTranscriptMatcher(parseTranscriptLine)),
}
