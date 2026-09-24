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
  content: z.array(z.unknown()),
})
const textBlockSchema = z.object({ type: z.literal('text'), text: z.string() })
const blockTypeSchema = z.object({ type: z.string() })

function textFromMessage(message: unknown, reportUnsupported: () => void): string | null {
  const text = textMessageSchema.safeParse(message)
  if (text.success) return text.data.content
  const blocks = contentBlocksSchema.safeParse(message)
  if (!blocks.success) {
    reportUnsupported()
    return null
  }
  return blocks.data.content
    .map((block) => {
      const kind = blockTypeSchema.safeParse(block)
      if (!kind.success) {
        reportUnsupported()
        return ''
      }
      switch (kind.data.type) {
        case 'text': {
          const visible = textBlockSchema.safeParse(block)
          if (!visible.success) reportUnsupported()
          return visible.success ? visible.data.text : ''
        }
        case 'tool_use':
        case 'tool_result':
        case 'thinking':
        case 'redacted_thinking':
        case 'image':
          return ''
        default:
          reportUnsupported()
          return ''
      }
    })
    .join('')
}

export function parseClaudeHistory(records: unknown[]): SessionHistoryEntry[] {
  let unsupportedCount = 0
  const reportUnsupported = () => {
    unsupportedCount += 1
  }
  const entries = records.flatMap((record) => {
    const message = messageSchema.safeParse(record)
    if (!message.success) {
      reportUnsupported()
      return []
    }
    const text = textFromMessage(message.data.message, reportUnsupported)
    return text === null || text === ''
      ? []
      : [{ sourceId: message.data.uuid, role: message.data.type, text }]
  })
  if (unsupportedCount > 0) {
    console.warn(
      `Claude history contained ${unsupportedCount} unsupported record or content shapes`,
    )
  }
  return entries
}

export async function readClaudeHistory(nativeId: string): Promise<SessionHistoryEntry[]> {
  return parseClaudeHistory(await getSessionMessages(nativeId))
}
