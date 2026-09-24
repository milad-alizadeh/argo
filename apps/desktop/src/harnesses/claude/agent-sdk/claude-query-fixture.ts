import type {
  ApiKeySource,
  CanUseTool,
  OnUserDialog,
  Query,
  SDKAssistantMessageError,
  SDKMessage,
  SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk'
import type { SessionService } from '@/domains/sessions/main/lifecycle/session-service'
import {
  assistantErrorMessage,
  assistantMessage,
  initMessage,
} from './claude-query-fixture-message'

export const managedSessionService: SessionService = {
  acquire: () => ({ posture: 'managed' }),
  renew: () => ({ posture: 'managed' }),
  release: () => {},
}

function fakeQuery(hooks: {
  sent: SDKUserMessage[]
  onInterrupt: () => void
  onClose: () => void
  setDeliver: (deliver: (message: SDKMessage) => void) => void
  setFinish: (finish: () => void) => void
  setCallbacks: (callbacks: { canUseTool: CanUseTool; onUserDialog: OnUserDialog }) => void
  setReceivedOptions: (options: {
    model: string | undefined
    effort: string | undefined
    permissionMode: string | undefined
  }) => void
}) {
  const { sent, onInterrupt, onClose, setDeliver, setFinish, setCallbacks, setReceivedOptions } =
    hooks
  return function createQuery({
    prompt,
    canUseTool,
    onUserDialog,
    model,
    effort,
    permissionMode,
  }: {
    prompt: AsyncIterable<SDKUserMessage>
    resume: string | undefined
    canUseTool: CanUseTool
    onUserDialog: OnUserDialog
    model?: string
    effort?: string
    permissionMode?: string
  }): Query {
    setCallbacks({ canUseTool, onUserDialog })
    setReceivedOptions({ model, effort, permissionMode })
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
              setFinish(() => resolve({ value: undefined as never, done: true }))
            })
          },
        }
      },
    } as unknown as Query
  }
}

export function fakeClaudeQuery() {
  let deliver: ((message: SDKMessage) => void) | undefined
  let finish: (() => void) | undefined
  let callbacks: { canUseTool: CanUseTool; onUserDialog: OnUserDialog } | undefined
  let receivedOptions: {
    model: string | undefined
    effort: string | undefined
    permissionMode: string | undefined
  } = { model: undefined, effort: undefined, permissionMode: undefined }
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
    setFinish: (next) => {
      finish = next
    },
    setCallbacks: (next) => {
      callbacks = next
    },
    setReceivedOptions: (next) => {
      receivedOptions = next
    },
  })

  return {
    createQuery,
    emitInit: ({ apiKeySource }: { apiKeySource: ApiKeySource }) =>
      deliver?.(initMessage(apiKeySource)),
    emitAssistantError: (error: SDKAssistantMessageError) =>
      deliver?.(assistantErrorMessage(error)),
    emitAssistant: (text: string) => deliver?.(assistantMessage(text)),
    emitMalformedMessage: () => deliver?.({ type: 'assistant' } as SDKMessage),
    // A refused `--resume` closes the stream after one error result, never emitting "system"/"init".
    endStream: () => finish?.(),
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
    get receivedOptions() {
      return receivedOptions
    },
  }
}

function mockPermissionOptions(toolUseID: string): Parameters<CanUseTool>[2] {
  return { signal: new AbortController().signal, toolUseID, requestId: toolUseID }
}
