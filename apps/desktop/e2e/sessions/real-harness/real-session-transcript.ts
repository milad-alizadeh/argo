import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type { SessionLiveEventBody } from '@/domains/sessions/api/session-live-event'

type TranscriptMatch = { size: number }
type HistoryChange = { type: 'appended'; events: SessionLiveEventBody[] } | { type: 'rewritten' }

// A Harness's own history reader, opened fresh per transcript: it follows the record chain and
// decodes each line into the same Feed events a real read publishes (ADR-0047).
export type OpenHistoryReader = () => (lines: readonly string[]) => HistoryChange

async function transcriptFiles(folder: string): Promise<string[]> {
  const names = await readdir(folder, { recursive: true }).catch(() => [])
  return names.filter((name) => name.endsWith('.jsonl')).map((name) => path.join(folder, name))
}

function messagesOf(change: HistoryChange) {
  if (change.type !== 'appended') return []
  return change.events.flatMap((event) =>
    event.type === 'content' && event.content.kind === 'message' ? [event.content] : [],
  )
}

async function assistantInTranscript(
  transcript: string,
  prompt: string,
  openReader: OpenHistoryReader,
): Promise<TranscriptMatch | null> {
  // A Harness can be part-way through a line; the next poll reads the file whole again.
  const lines = (await readFile(transcript, 'utf8').catch(() => '')).split('\n')
  const messages = messagesOf(openReader()(lines))
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
  openReader: OpenHistoryReader,
): Promise<TranscriptMatch | null> {
  for (const transcript of await transcriptFiles(folder)) {
    const matched = await assistantInTranscript(transcript, prompt, openReader)
    if (matched !== null) return matched
  }
  return null
}
