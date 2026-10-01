import path from 'node:path'
import { assistantAfterPrompt } from './real-session-transcript'
import { TRANSCRIPT_CONTENT } from './transcript-history'

export const realCodexCli = {
  authentication: ['login', 'status'],
  credential: ['.codex', 'auth.json'],
  linked: [],
  label: 'Codex',
  transcripts: (home: string) => path.join(home, '.codex', 'sessions'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, TRANSCRIPT_CONTENT.codex),
}
