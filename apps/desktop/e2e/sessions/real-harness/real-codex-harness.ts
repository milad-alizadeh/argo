import path from 'node:path'
import { openCodexHistoryReader } from '@/harnesses/codex/session/codex-history-lines'
import { assistantAfterPrompt } from './real-session-transcript'

export const realCodexCli = {
  authentication: ['login', 'status'],
  credential: ['.codex', 'auth.json'],
  linked: [],
  label: 'Codex',
  transcripts: (home: string) => path.join(home, '.codex', 'sessions'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, () => openCodexHistoryReader()),
}
