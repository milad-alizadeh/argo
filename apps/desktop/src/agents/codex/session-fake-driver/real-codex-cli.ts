import path from 'node:path'
import { assistantAfterPrompt } from '../../../core/sessions/fake-driver/real-session-transcript'
import { parseCodexTranscriptLine } from '../sessions/records'

function isPrompt(line: string, prompt: string) {
  const record = parseCodexTranscriptLine(line)
  return (
    record?.kind === 'message' &&
    record.role === 'user' &&
    record.blocks.some((block) => block.shape === 'prose' && block.text === prompt)
  )
}

function isAssistant(line: string) {
  const record = parseCodexTranscriptLine(line)
  return record?.kind === 'message' && record.role === 'assistant'
}

export const realCodexCli = {
  authentication: ['login', 'status'],
  credential: ['.codex', 'auth.json'],
  label: 'Codex',
  transcripts: (home: string) => path.join(home, '.codex', 'sessions'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, { isAssistant, isPrompt }),
}
