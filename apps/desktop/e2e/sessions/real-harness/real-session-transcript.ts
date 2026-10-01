import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { FeedContent } from '@/domains/sessions/api/feed-content'

type TranscriptMatch = { size: number }

// Decodes a transcript's lines into the Feed content a real read publishes.
export type TranscriptContent = (lines: readonly string[]) => FeedContent[]

async function transcriptFiles(folder: string): Promise<string[]> {
  const names = await readdir(folder, { recursive: true }).catch(() => [])
  return names.filter((name) => name.endsWith('.jsonl')).map((name) => path.join(folder, name))
}

function messagesOf(content: readonly FeedContent[]) {
  return content.flatMap((entry) => (entry.kind === 'message' ? [entry] : []))
}

async function assistantInTranscript(
  transcript: string,
  prompt: string,
  decode: TranscriptContent,
): Promise<TranscriptMatch | null> {
  // A Harness can be part-way through a line; the next poll reads the file whole again.
  const lines = (await readFile(transcript, 'utf8').catch(() => '')).split('\n')
  const messages = messagesOf(decode(lines))
  const promptAt = messages.findIndex(
    (message) => message.role === 'user' && message.text.includes(prompt),
  )
  if (promptAt === -1) return null
  const replied = messages.slice(promptAt + 1).some((message) => message.role === 'assistant')
  return replied ? { size: (await stat(transcript)).size } : null
}

export async function assistantAfterPrompt(
  folder: string,
  prompt: string,
  decode: TranscriptContent,
): Promise<TranscriptMatch | null> {
  for (const transcript of await transcriptFiles(folder)) {
    const matched = await assistantInTranscript(transcript, prompt, decode)
    if (matched !== null) return matched
  }
  return null
}
