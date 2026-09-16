import path from 'node:path'
import { assistantAfterPrompt } from '../../../core/sessions/fake-driver/real-session-transcript'
import { parseTranscriptLine } from '../sessions/records'

function isPrompt(line: string, prompt: string) {
  const record = parseTranscriptLine(line)
  return (
    record?.kind === 'message' &&
    record.role === 'user' &&
    record.blocks.some((block) => block.shape === 'prose' && block.text === prompt)
  )
}

function isAssistant(line: string) {
  const record = parseTranscriptLine(line)
  return record?.kind === 'message' && record.role === 'assistant'
}

export const realClaudeCli = {
  authentication: ['auth', 'status'],
  credential: ['.claude.json'],
  label: 'Claude',
  transcripts: (home: string) => path.join(home, '.claude', 'projects'),
  replyAfterPrompt: (folder: string, prompt: string) =>
    assistantAfterPrompt(folder, prompt, { isAssistant, isPrompt }),
}
