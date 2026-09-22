import type {
  ApiKeySource,
  CanUseTool,
  OnUserDialog,
  PermissionResult,
  Query,
  SDKAssistantMessageError,
  SDKMessage,
  SDKUserMessage,
  UserDialogResult,
} from '@anthropic-ai/claude-agent-sdk'
import type { ClaudeQueryFactory } from '@/harnesses/claude/agent-sdk/claude-session-actor'

export type FakeClaudeQuery = {
  createQuery: ClaudeQueryFactory
  renameSession: (sessionId: string, title: string) => Promise<void>
  emitInit: (fields: { apiKeySource: ApiKeySource }) => void
  emitAssistantError: (error: SDKAssistantMessageError) => void
  requestApproval: (toolUseID: string, toolName: string) => Promise<PermissionResult | null>
  requestDialog: (requestId: string) => Promise<UserDialogResult | null>
  sentPrompts: () => string[]
  interruptCalls: number
  closed: boolean
  renamedTo: string[]
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
  setCallbacks: (callbacks: { canUseTool: CanUseTool; onUserDialog: OnUserDialog }) => void
}) {
  const { sent, onInterrupt, onClose, setDeliver, setCallbacks } = hooks
  return function createQuery({
    prompt,
    canUseTool,
    onUserDialog,
  }: {
    prompt: AsyncIterable<SDKUserMessage>
    canUseTool: CanUseTool
    onUserDialog: OnUserDialog
  }): Query {
    setCallbacks({ canUseTool, onUserDialog })
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
  let callbacks: { canUseTool: CanUseTool; onUserDialog: OnUserDialog } | undefined
  const sent: SDKUserMessage[] = []
  const renamedTo: string[] = []
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
    setCallbacks: (next) => {
      callbacks = next
    },
  })

  return {
    createQuery,
    renamedTo,
    renameSession: async (_sessionId, title) => {
      renamedTo.push(title)
    },
    emitInit: ({ apiKeySource }) => deliver?.(initMessage(apiKeySource)),
    emitAssistantError: (error) => deliver?.(assistantErrorMessage(error)),
    requestApproval: (toolUseID, toolName) => {
      if (callbacks === undefined) throw new Error('createQuery was never called')
      return callbacks.canUseTool(toolName, {}, mockPermissionOptions(toolUseID))
    },
    requestDialog: (requestId) => {
      if (callbacks === undefined) throw new Error('createQuery was never called')
      return callbacks.onUserDialog(
        { dialogKind: 'test', payload: {} },
        { signal: new AbortController().signal, requestId },
      )
    },
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

function mockPermissionOptions(toolUseID: string): Parameters<CanUseTool>[2] {
  return { signal: new AbortController().signal, toolUseID, requestId: toolUseID }
}
