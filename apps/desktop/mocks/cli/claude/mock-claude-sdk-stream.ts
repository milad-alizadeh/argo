import { randomUUID } from 'node:crypto'

const INITIALIZATION_DELAY_MS = 50
const MODELS = [
  {
    value: 'fable',
    resolvedModel: 'claude-fable-5-1',
    displayName: 'Fable 5.1',
    description: 'Mock Fable model',
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
  {
    value: 'opus',
    resolvedModel: 'claude-opus-5',
    displayName: 'Opus 5',
    description: 'Mock Opus model',
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
  {
    value: 'sonnet',
    resolvedModel: 'claude-sonnet-5',
    displayName: 'Sonnet 5',
    description: 'Mock Sonnet model',
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
  {
    value: 'haiku',
    resolvedModel: 'claude-haiku-4-5',
    displayName: 'Haiku 4.5',
    description: 'Mock Haiku model',
    supportedEffortLevels: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
]

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

type WaitForPermission = () => Promise<void>

export function startMockClaudeSdkStream(
  sessionId: string,
  reply: (prompt: string, waitForPermission: WaitForPermission) => Promise<string>,
) {
  writeInitialization(sessionId)
  let pending = ''
  const pendingPermissions = new Map<string, () => void>()
  const waitForPermission: WaitForPermission = () => {
    const requestId = randomUUID()
    process.stdout.write(
      `${JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'bun test' }, tool_use_id: requestId } })}\n`,
    )
    return new Promise((resolve) => pendingPermissions.set(requestId, resolve))
  }
  process.stdin.on('data', (chunk: string) => {
    pending += chunk
    for (const line of pending.split('\n').slice(0, -1)) {
      const input = JSON.parse(line)
      const initializationId = initializationRequestId(input)
      if (initializationId !== null) {
        process.stdout.write(
          `${JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: initializationId, response: {} } })}\n`,
        )
        continue
      }
      const permissionId = permissionResponseId(input)
      if (permissionId !== null) {
        pendingPermissions.get(permissionId)?.()
        pendingPermissions.delete(permissionId)
        continue
      }
      const text = promptText(input)
      if (text === null) continue
      void reply(text, waitForPermission).then((response) =>
        setTimeout(() => writeReply(sessionId, response), INITIALIZATION_DELAY_MS),
      )
    }
    pending = pending.includes('\n') ? pending.slice(pending.lastIndexOf('\n') + 1) : pending
  })
}

function writeInitialization(sessionId: string) {
  process.stdout.write(
    `${JSON.stringify({
      type: 'system',
      subtype: 'init',
      apiKeySource: 'none',
      claude_code_version: '2.1.0',
      cwd: process.cwd(),
      tools: [],
      mcp_servers: [],
      model: 'claude-opus-5',
      models: MODELS,
      permissionMode: 'default',
      slash_commands: [],
      output_style: 'default',
      skills: [],
      plugins: [],
      session_id: sessionId,
      uuid: randomUUID(),
    })}\n`,
  )
}

export function initializationRequestId(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || !('type' in input)) return null
  if (input.type !== 'control_request' || !('request_id' in input) || !('request' in input))
    return null
  const { request } = input
  if (typeof request !== 'object' || request === null || request.subtype !== 'initialize')
    return null
  return typeof input.request_id === 'string' ? input.request_id : null
}

export function permissionResponseId(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || !('type' in input)) return null
  if (input.type !== 'control_response' || !('response' in input)) return null
  const { response } = input
  if (typeof response !== 'object' || response === null || !('request_id' in response)) return null
  return typeof response.request_id === 'string' ? response.request_id : null
}

function writeReply(sessionId: string, response: string) {
  process.stdout.write(
    `${JSON.stringify({ type: 'assistant', session_id: sessionId, uuid: randomUUID(), parent_tool_use_id: null, message: { id: randomUUID(), type: 'message', role: 'assistant', model: 'claude-opus-4-6', content: [{ type: 'text', text: response }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } })}\n`,
  )
  process.stdout.write(
    `${JSON.stringify({ type: 'result', subtype: 'success', duration_ms: 0, duration_api_ms: 0, is_error: false, num_turns: 1, result: response, stop_reason: 'end_turn', total_cost_usd: 0, usage: { input_tokens: 0, output_tokens: 0 }, modelUsage: {}, permission_denials: [], session_id: sessionId, uuid: randomUUID() })}\n`,
  )
}
