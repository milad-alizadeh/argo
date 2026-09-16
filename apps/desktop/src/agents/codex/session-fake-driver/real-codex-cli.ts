import path from 'node:path'
import {
  assistantAfterPrompt,
  createTranscriptMatcher,
} from '../../../core/sessions/fake-driver/real-session-transcript'
import { parseCodexTranscriptLine } from '../sessions/records'

export const realCodexCli = {
  authentication: ['login', 'status'],
  credential: ['.codex', 'auth.json'],
  label: 'Codex',
  transcripts: (home: string) => path.join(home, '.codex', 'sessions'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, createTranscriptMatcher(parseCodexTranscriptLine)),
}
