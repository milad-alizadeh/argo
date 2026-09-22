import type { PermissionResult, SDKMessage, UserDialogResult } from '@anthropic-ai/claude-agent-sdk'
import { fromCallback } from 'xstate'
import { createPendingRequestRegistry } from '@/harnesses/claude/agent-sdk/pending-request-registry'
import {
  createStreamInputChannel,
  userMessage,
} from '@/harnesses/claude/agent-sdk/stream-input-channel'
import type { ClaudeSessionEvent, ClaudeSessionInput } from '@/harnesses/claude/agent-sdk/types'

function handleEvent(options: {
  event: ClaudeSessionEvent
  approvals: ReturnType<typeof createPendingRequestRegistry<PermissionResult | null>>
  channel: ReturnType<typeof createStreamInputChannel>
  dialogs: ReturnType<typeof createPendingRequestRegistry<UserDialogResult>>
  input: ClaudeSessionInput
  query: Query
  session: { current: ClaudeSessionInput['session'] }
}) {
  const { approvals, channel, dialogs, event, input, query, session } = options
  switch (event.type) {
    case 'Send':
    case 'Steer':
      channel.push(userMessage(event.prompt))
      return
    case 'Interrupt':
      void query.interrupt()
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
      if (session.current !== null) void input.renameSession(session.current.nativeId, event.title)
      return
    case 'Session identified':
      session.current = event.session
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
    channel.push(userMessage(input.prompt))
    const approvals = createPendingRequestRegistry<PermissionResult | null>(null)
    const dialogs = createPendingRequestRegistry<UserDialogResult>({ behavior: 'cancelled' })
    const query = input.createQuery({
      prompt: channel.iterable,
      cwd: input.cwd,
      resume: input.session?.nativeId,
      canUseTool: (_toolName, _toolInput, options) => approvals.register(options.toolUseID),
      onUserDialog: (_request, options) => dialogs.register(options.requestId),
    })
    let stopped = false
    const session = { current: input.session }

    void (async () => {
      try {
        for await (const message of query) {
          if (stopped) return
          sendBack({ type: 'SDK message', message: message as SDKMessage })
        }
        if (!stopped) sendBack({ type: 'SDK ended' })
      } catch {
        if (!stopped) sendBack({ type: 'SDK failed' })
      }
    })()

    receive((event: ClaudeSessionEvent) =>
      handleEvent({ approvals, channel, dialogs, event, input, query, session }),
    )

    return () => {
      stopped = true
      approvals.cancelAll()
      dialogs.cancelAll()
      channel.close()
      query.close()
    }
  },
)
