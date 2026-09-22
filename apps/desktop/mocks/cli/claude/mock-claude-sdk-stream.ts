import { randomUUID } from 'node:crypto'

function textOf(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || !('message' in input)) return null
  const message = input.message
  if (typeof message !== 'object' || message === null || !('content' in message)) return null
  const content = message.content
  if (!Array.isArray(content)) return null
  const text = content.find(
    (part) => typeof part === 'object' && part !== null && part.type === 'text',
  )
  return typeof text === 'object' &&
    text !== null &&
    'text' in text &&
    typeof text.text === 'string'
    ? text.text
    : null
}

export function startMockClaudeSdkStream(sessionId: string, reply: (prompt: string) => string) {
  process.stdout.write(
    `${JSON.stringify({ type: 'system', subtype: 'init', apiKeySource: 'none', session_id: sessionId, uuid: randomUUID() })}\n`,
  )
  let pending = ''
  process.stdin.on('data', (chunk: string) => {
    pending += chunk
    for (const line of pending.split('\n').slice(0, -1)) {
      const text = textOf(JSON.parse(line))
      if (text === null) continue
      const response = reply(text)
      process.stdout.write(
        `${JSON.stringify({ type: 'assistant', session_id: sessionId, uuid: randomUUID(), parent_tool_use_id: null, message: { id: randomUUID(), role: 'assistant', content: [{ type: 'text', text: response }] } })}\n`,
      )
      process.stdout.write(
        `${JSON.stringify({ type: 'result', subtype: 'success', session_id: sessionId, uuid: randomUUID() })}\n`,
      )
    }
    pending = pending.includes('\n') ? pending.slice(pending.lastIndexOf('\n') + 1) : pending
  })
}
