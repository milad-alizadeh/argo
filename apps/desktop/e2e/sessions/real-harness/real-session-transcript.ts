import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { TranscriptRecord } from '@/domains/sessions/renderer/feed/source/transcript'

type TranscriptMatch = { size: number }
type TranscriptMatcher = {
  isAssistant: (line: string) => boolean
  isPrompt: (line: string, prompt: string) => boolean
}

export function createTranscriptMatcher(
  parse: (line: string) => TranscriptRecord | null,
): TranscriptMatcher {
  return {
    isAssistant: (line) => {
      const record = parse(line)
      return record?.kind === 'message' && record.role === 'assistant'
    },
    isPrompt: (line, prompt) => {
      const record = parse(line)
      return (
        record?.kind === 'message' &&
        record.role === 'user' &&
        record.blocks.some((block) => block.shape === 'prose' && block.text === prompt)
      )
    },
  }
}

async function transcriptFiles(folder: string): Promise<string[]> {
  const names = await readdir(folder, { recursive: true }).catch(() => [])
  return names.filter((name) => name.endsWith('.jsonl')).map((name) => path.join(folder, name))
}

async function assistantInTranscript(
  transcript: string,
  prompt: string,
  matcher: TranscriptMatcher,
): Promise<TranscriptMatch | null> {
  const lines = (await readFile(transcript, 'utf8').catch(() => '')).split('\n')
  let foundPrompt = false
  for (const line of lines) {
    if (!foundPrompt && matcher.isPrompt(line, prompt)) foundPrompt = true
    if (!foundPrompt) continue
    try {
      if (matcher.isAssistant(line)) return { size: (await stat(transcript)).size }
    } catch {
      // A Harness can have appended a partial line; the next poll will read it whole.
    }
  }
  return null
}

export async function assistantAfterPrompt(
  folder: string,
  prompt: string,
  matcher: TranscriptMatcher,
): Promise<TranscriptMatch | null> {
  for (const transcript of await transcriptFiles(folder)) {
    const matched = await assistantInTranscript(transcript, prompt, matcher)
    if (matched !== null) return matched
  }
  return null
}
