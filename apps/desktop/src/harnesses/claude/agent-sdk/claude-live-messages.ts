import type { ClaudeSdkMessage } from '@/harnesses/claude/agent-sdk/types'

export function appendAssistantMessage(
  messages: { id: string; text: string }[],
  message: ClaudeSdkMessage,
) {
  if (message.type !== 'assistant') return messages
  const assistant = message as unknown as { uuid: string; message?: { content?: unknown } }
  const content = assistant.message?.content
  if (!Array.isArray(content)) return messages
  const text = content
    .filter(
      (part): part is { type: 'text'; text: string } =>
        typeof part === 'object' &&
        part !== null &&
        part.type === 'text' &&
        typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('')
  return text.length === 0
    ? messages
    : [...messages.filter((item) => item.id !== assistant.uuid), { id: assistant.uuid, text }]
}
