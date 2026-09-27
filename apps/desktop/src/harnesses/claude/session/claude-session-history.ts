import { getSessionMessages, type SessionMessage } from '@anthropic-ai/claude-agent-sdk'
import type { SessionHistoryRow } from '@/domains/sessions/api/session-history'

function messageText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() === '' ? null : value
  if (Array.isArray(value)) {
    const text = value
      .flatMap((block) => {
        if (typeof block !== 'object' || block === null || !('type' in block)) return []
        if (block.type !== 'text' || !('text' in block) || typeof block.text !== 'string') return []
        return [block.text]
      })
      .join('\n')
      .trim()
    return text === '' ? null : text
  }
  return null
}

export function projectClaudeSessionMessages(
  messages: readonly SessionMessage[],
): SessionHistoryRow[] {
  return messages.flatMap((entry) => {
    if (entry.type !== 'user' && entry.type !== 'assistant') return []
    const message = entry.message
    const content =
      typeof message === 'object' && message !== null && 'content' in message
        ? message.content
        : null
    const text = messageText(content)
    if (text === null) return []
    return [{ shape: 'prose', id: entry.uuid, role: entry.type, text }]
  })
}

export async function readClaudeSessionHistory(
  nativeId: string,
  cwd: string | null,
): Promise<SessionHistoryRow[]> {
  const messages = await getSessionMessages(nativeId, cwd === null ? {} : { dir: cwd })
  return projectClaudeSessionMessages(messages)
}
