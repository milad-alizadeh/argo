import type {
  ApiKeySource,
  CanUseTool,
  OnUserDialog,
  Query,
  SDKAssistantMessageError,
  SDKMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type { SessionService } from '@/domains/sessions/next/main/session-service'
import { assistantMessage } from './claude-query-fixture-message'

export const managedSessionService: SessionService = {
  acquire: () => ({ posture: 'managed' }),
  renew: () => ({ posture: 'managed' }),
  release: () => {},
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
    resume: string | undefined
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

export function fakeClaudeQuery() {
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
    renameSession: async (_sessionId: string, title: string) => {
      renamedTo.push(title)
    },
    emitInit: ({ apiKeySource }: { apiKeySource: ApiKeySource }) =>
      deliver?.(initMessage(apiKeySource)),
    emitAssistantError: (error: SDKAssistantMessageError) =>
      deliver?.(assistantErrorMessage(error)),
    emitAssistant: (text: string) => deliver?.(assistantMessage(text)),
    emitMalformedMessage: () => deliver?.({ type: 'assistant' } as SDKMessage),
    requestApproval: (toolUseID: string, toolName: string) => {
      if (callbacks === undefined) throw new Error('createQuery was never called')
      return callbacks.canUseTool(toolName, {}, mockPermissionOptions(toolUseID))
    },
    requestDialog: (requestId: string) => {
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
