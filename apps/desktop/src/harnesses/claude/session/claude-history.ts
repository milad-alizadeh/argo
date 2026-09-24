import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { SessionHistoryEntry } from '@/domains/sessions/contract/session-history'

const messageSchema = z.object({
  type: z.enum(['user', 'assistant', 'system']),
  uuid: z.string().min(1),
  message: z.unknown(),
})
const textMessageSchema = z.object({ content: z.string() })
const contentBlocksSchema = z.object({
  content: z.array(z.object({ type: z.literal('text'), text: z.string() })),
})

function textFromMessage(message: unknown): string | null {
  const text = textMessageSchema.safeParse(message)
  if (text.success) return text.data.content
  const blocks = contentBlocksSchema.safeParse(message)
  return blocks.success ? blocks.data.content.map(({ text }) => text).join('') : null
}

export function parseClaudeHistory(records: unknown[]): SessionHistoryEntry[] {
  return records.flatMap((record) => {
    const message = messageSchema.safeParse(record)
    if (!message.success) return []
    const text = textFromMessage(message.data.message)
    return text === null || text === ''
      ? []
      : [{ sourceId: message.data.uuid, role: message.data.type, text }]
  })
}

export async function readClaudeHistory(nativeId: string): Promise<SessionHistoryEntry[]> {
  return parseClaudeHistory(await getSessionMessages(nativeId))
}
