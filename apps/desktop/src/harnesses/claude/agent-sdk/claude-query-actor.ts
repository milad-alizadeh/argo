import type { PermissionResult, Query, UserDialogResult } from '@anthropic-ai/claude-agent-sdk'
import { fromCallback } from 'xstate'
import { createPendingRequestRegistry } from '@/harnesses/claude/agent-sdk/pending-request-registry'
import {
  createStreamInputChannel,
  userMessage,
} from '@/harnesses/claude/agent-sdk/stream-input-channel'
import {
  type ClaudeSessionEvent,
  type ClaudeSessionInput,
  claudeSdkMessageSchema,
} from '@/harnesses/claude/agent-sdk/types'

function handleEvent(options: {
  event: ClaudeSessionEvent
  approvals: ReturnType<typeof createPendingRequestRegistry<PermissionResult | null>>
  channel: ReturnType<typeof createStreamInputChannel>
  dialogs: ReturnType<typeof createPendingRequestRegistry<UserDialogResult>>
  input: ClaudeSessionInput
  query: { current: Query }
  session: { current: ClaudeSessionInput['session'] }
}) {
  const { approvals, channel, dialogs, event, input, query, session } = options
  switch (event.type) {
    case 'Send':
    case 'Steer':
      channel.push(userMessage(event.prompt))
      return
    case 'Interrupt':
      void query.current.interrupt()
      return
    case 'Decide':
      approvals.resolve(
        event.approvalId,
        event.decision === 'approve'
          ? { behavior: 'allow' }
          : { behavior: 'deny', message: 'Rejected by user' },
      )
      return
    case 'Answer':
      dialogs.resolve(event.questionId, { behavior: 'completed', result: event.answer })
      return
    case 'Rename':
      channel.push(userMessage(`/rename ${event.title}`))
      return
    case 'Session identified':
      session.current = event.session
      if (input.session === null) channel.push(userMessage(input.prompt))
      return
    default:
      return
  }
}

// The invoked actor owns the SDK query, its process, the streaming-input channel, and the
// pending-approval/pending-dialog resolvers. Machine context never holds them, so a persisted or
// inspected snapshot carries no live resource.
export const claudeQueryLogic = fromCallback<ClaudeSessionEvent, ClaudeSessionInput>(
  ({ input, sendBack, receive }) => {
    const channel = createStreamInputChannel()
    if (input.session !== null) channel.push(userMessage(input.prompt))
    const approvals = createPendingRequestRegistry<PermissionResult | null>(null)
    const dialogs = createPendingRequestRegistry<UserDialogResult>({ behavior: 'cancelled' })
    let stopped = false
    let retries = 0
    const session = { current: input.session }
    const query = { current: createQuery({ input, channel, approvals, dialogs, session }) }
    const recover = () => {
      if (stopped) return
      const canRetry = session.current !== null && retries === 0
      if (!canRetry) {
        sendBack({ type: 'SDK failed' })
        return
      }
      retries += 1
      sendBack({ type: 'Channel lost' })
      query.current = createQuery({ input, channel, approvals, dialogs, session })
      void read()
    }

    const read = async (): Promise<void> => {
      try {
        for await (const message of query.current) {
          if (stopped) return
          const parsed = claudeSdkMessageSchema.safeParse(message)
          if (!parsed.success) {
            sendBack({ type: 'SDK failed' })
            return
          }
          sendBack({ type: 'SDK message', message: parsed.data })
        }
        if (!stopped) sendBack({ type: 'SDK ended' })
      } catch {
        recover()
      }
    }
    void read()

    receive((event: ClaudeSessionEvent) =>
      handleEvent({ approvals, channel, dialogs, event, input, query, session }),
    )

    return () => {
      stopped = true
      approvals.cancelAll()
      dialogs.cancelAll()
      channel.close()
      query.current.close()
    }
  },
)

function createQuery(options: {
  input: ClaudeSessionInput
  channel: ReturnType<typeof createStreamInputChannel>
  approvals: ReturnType<typeof createPendingRequestRegistry<PermissionResult | null>>
  dialogs: ReturnType<typeof createPendingRequestRegistry<UserDialogResult>>
  session: { current: ClaudeSessionInput['session'] }
}): Query {
  const { input, channel, approvals, dialogs, session } = options
  return input.createQuery({
    prompt: channel.iterable,
    cwd: input.cwd,
    resume: session.current?.nativeId,
    canUseTool: (_toolName, _toolInput, options) => approvals.register(options.toolUseID),
    onUserDialog: (_request, options) => dialogs.register(options.requestId),
  })
}
