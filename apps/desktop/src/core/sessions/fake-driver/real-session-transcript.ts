import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

type TranscriptMatch = { path: string; size: number }

async function transcriptFiles(folder: string): Promise<string[]> {
  const names = await readdir(folder, { recursive: true }).catch(() => [])
  return names.filter((name) => name.endsWith('.jsonl')).map((name) => path.join(folder, name))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assistantRecord(value: unknown) {
  if (!isRecord(value)) return false
  if (value.type === 'assistant') return true
  const payload = isRecord(value.payload) ? value.payload : null
  if (payload === null) return false
  if (value.type === 'response_item')
    return payload.type === 'message' && payload.role === 'assistant'
  const item = isRecord(payload.item) ? payload.item : null
  return (
    value.type === 'event_msg' && payload.type === 'agent_message' && item?.type === 'AgentMessage'
  )
}

async function assistantInTranscript(
  transcript: string,
  prompt: string,
): Promise<TranscriptMatch | null> {
  const lines = (await readFile(transcript, 'utf8').catch(() => '')).split('\n')
  let foundPrompt = false
  for (const line of lines) {
    if (!foundPrompt && line.includes(prompt)) foundPrompt = true
    if (!foundPrompt) continue
    try {
      if (assistantRecord(JSON.parse(line)))
        return { path: transcript, size: (await stat(transcript)).size }
    } catch {
      // A CLI can have appended a partial line; the next poll will read it whole.
    }
  }
  return null
}

export async function assistantAfterPrompt(
  folder: string,
  prompt: string,
): Promise<TranscriptMatch | null> {
  for (const transcript of await transcriptFiles(folder)) {
    const matched = await assistantInTranscript(transcript, prompt)
    if (matched !== null) return matched
  }
  return null
}
