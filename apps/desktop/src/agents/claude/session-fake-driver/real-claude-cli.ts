import path from 'node:path'
import {
  assistantAfterPrompt,
  createTranscriptMatcher,
} from '../../../core/sessions/fake-driver/real-session-transcript'
import { parseTranscriptLine } from '../sessions/records'

export const realClaudeCli = {
  authentication: ['auth', 'status'],
  credential: ['.claude.json'],
  label: 'Claude',
  transcripts: (home: string) => path.join(home, '.claude', 'projects'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, createTranscriptMatcher(parseTranscriptLine)),
}
