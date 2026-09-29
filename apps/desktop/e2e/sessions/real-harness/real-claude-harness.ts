import path from 'node:path'
import { openClaudeHistoryReader } from '@/harnesses/claude/session/claude-history-lines'
import { assistantAfterPrompt } from './real-session-transcript'

export const realClaudeCli = {
  authentication: ['doctor'],
  credential: ['.claude', '.credentials.json'],
  linked: ['.claude.json'],
  label: 'Claude',
  transcripts: (home: string) => path.join(home, '.claude', 'projects'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, () => openClaudeHistoryReader()),
}
