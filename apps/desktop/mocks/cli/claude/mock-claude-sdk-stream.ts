import { randomUUID } from 'node:crypto'

const INITIALIZATION_DELAY_MS = 50

export function promptText(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || !('message' in input)) return null
  const message = input.message
  if (typeof message !== 'object' || message === null || !('content' in message)) return null
  const content = message.content
  if (typeof content === 'string') return content
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
    `${JSON.stringify({ type: 'system', subtype: 'init', apiKeySource: 'none', claude_code_version: '2.1.0', cwd: process.cwd(), tools: [], mcp_servers: [], model: 'claude-opus-4-6', permissionMode: 'default', slash_commands: [], output_style: 'default', skills: [], plugins: [], session_id: sessionId, uuid: randomUUID() })}\n`,
  )
  let pending = ''
  process.stdin.on('data', (chunk: string) => {
    pending += chunk
    for (const line of pending.split('\n').slice(0, -1)) {
      const text = promptText(JSON.parse(line))
      if (text === null) continue
      setTimeout(() => writeReply(sessionId, reply(text)), INITIALIZATION_DELAY_MS)
    }
    pending = pending.includes('\n') ? pending.slice(pending.lastIndexOf('\n') + 1) : pending
  })
}

function writeReply(sessionId: string, response: string) {
  process.stdout.write(
    `${JSON.stringify({ type: 'assistant', session_id: sessionId, uuid: randomUUID(), parent_tool_use_id: null, message: { id: randomUUID(), type: 'message', role: 'assistant', model: 'claude-opus-4-6', content: [{ type: 'text', text: response }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } })}\n`,
  )
  process.stdout.write(
    `${JSON.stringify({ type: 'result', subtype: 'success', duration_ms: 0, duration_api_ms: 0, is_error: false, num_turns: 1, result: response, stop_reason: 'end_turn', total_cost_usd: 0, usage: { input_tokens: 0, output_tokens: 0 }, modelUsage: {}, permission_denials: [], session_id: sessionId, uuid: randomUUID() })}\n`,
  )
}
