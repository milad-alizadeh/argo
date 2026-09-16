import path from 'node:path'
import { parseCodexTranscriptLine } from '../../../src/agents/codex/sessions/records'
import { assistantAfterPrompt, createTranscriptMatcher } from './real-session-transcript'

export const realCodexCli = {
  authentication: ['login', 'status'],
  credential: ['.codex', 'auth.json'],
  label: 'Codex',
  transcripts: (home: string) => path.join(home, '.codex', 'sessions'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, createTranscriptMatcher(parseCodexTranscriptLine)),
}
