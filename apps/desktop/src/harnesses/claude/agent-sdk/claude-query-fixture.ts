import type {
  ApiKeySource,
  Query,
  SDKAssistantMessageError,
  SDKMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type { ClaudeQueryFactory } from '@/harnesses/claude/agent-sdk/claude-session-actor'

export type FakeClaudeQuery = {
  createQuery: ClaudeQueryFactory
  emitInit: (fields: { apiKeySource: ApiKeySource }) => void
  emitAssistantError: (error: SDKAssistantMessageError) => void
  sentPrompts: () => string[]
  interruptCalls: number
  closed: boolean
}

function initMessage(apiKeySource: ApiKeySource): SDKMessage {
  return {
    type: 'system',
    subtype: 'init',
    apiKeySource,
    claude_code_version: '0.0.0',
    cwd: '/repository',
    tools: [],
    mcp_servers: [],
    model: 'claude-fable-5',
    permissionMode: 'default',
    slash_commands: [],
    output_style: 'default',
    skills: [],
    plugins: [],
    uuid: '00000000-0000-0000-0000-000000000000',
    session_id: 'native-1',
  } as SDKMessage
}

function assistantErrorMessage(error: SDKAssistantMessageError): SDKMessage {
  return {
    type: 'assistant',
    error,
    uuid: '00000000-0000-0000-0000-000000000001',
    session_id: 'native-1',
  } as unknown as SDKMessage
}

function fakeQuery(hooks: {
  sent: SDKUserMessage[]
  onInterrupt: () => void
  onClose: () => void
  setDeliver: (deliver: (message: SDKMessage) => void) => void
}) {
  const { sent, onInterrupt, onClose, setDeliver } = hooks
  return function createQuery({ prompt }: { prompt: AsyncIterable<SDKUserMessage> }): Query {
    void (async () => {
      for await (const message of prompt) sent.push(message)
    })()

    return {
      interrupt: async () => {
        onInterrupt()
        return undefined
      },
      close: onClose,
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<SDKMessage>> {
            return new Promise((resolve) => {
              setDeliver((message) => resolve({ value: message, done: false }))
            })
          },
        }
      },
    } as unknown as Query
  }
}

// Stands in for the Claude Agent SDK subprocess: a paid vendor call CI cannot reach, so tests
// drive it through a synthetic message stream instead of a live query().
export function fakeClaudeQuery(): FakeClaudeQuery {
  let deliver: ((message: SDKMessage) => void) | undefined
  const sent: SDKUserMessage[] = []
  let interruptCalls = 0
  let closed = false

  const createQuery = fakeQuery({
    sent,
    onInterrupt: () => {
      interruptCalls += 1
    },
    onClose: () => {
      closed = true
    },
    setDeliver: (next) => {
      deliver = next
    },
  })

  return {
    createQuery,
    emitInit: ({ apiKeySource }) => deliver?.(initMessage(apiKeySource)),
    emitAssistantError: (error) => deliver?.(assistantErrorMessage(error)),
    sentPrompts: () =>
      sent.map((message) =>
        typeof message.message.content === 'string' ? message.message.content : '',
      ),
    get interruptCalls() {
      return interruptCalls
    },
    get closed() {
      return closed
    },
  }
}
