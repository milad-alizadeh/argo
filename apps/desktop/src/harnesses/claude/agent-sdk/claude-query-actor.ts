import type {
  EffortLevel,
  PermissionMode,
  PermissionResult,
  Query,
  UserDialogResult,
} from '@anthropic-ai/claude-agent-sdk'
import { fromCallback } from 'xstate'
import type { ClaudeTurnSetup } from '@/domains/sessions/contract/claude-turn-setup'
import { createPendingRequestRegistry } from './pending-request-registry'
import { createStreamInputChannel, userMessage } from './stream-input-channel'
import { type ClaudeSessionEvent, type ClaudeSessionInput, claudeSdkMessageSchema } from './types'

function handleEvent(options: {
  event: ClaudeSessionEvent
  approvals: ReturnType<typeof createPendingRequestRegistry<PermissionResult | null>>
  channel: ReturnType<typeof createStreamInputChannel>
  dialogs: ReturnType<typeof createPendingRequestRegistry<UserDialogResult>>
  query: { current: Query }
  session: { current: ClaudeSessionInput['session'] }
}) {
  const { approvals, channel, dialogs, event, query, session } = options
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
    // A resume always pushes its prompt here. A fresh, non-deferred start instead waits and pushes
    // it once the Session is managed (`startInitialTurn` in claude-session-channel-states.ts), so the
    // Managed transition orders it. But a *deferred* fresh start (`startTurn: false`) has no other
    // trigger at all: the SDK's query() reads nothing — not even the "system"/"init" handshake that
    // carries the Session's nativeId — until the prompt iterable yields a first message (confirmed
    // against the installed @anthropic-ai/claude-agent-sdk: given an iterable that never yields, it
    // never emits anything), so without this push a deferred Session can never even identify.
    if (input.session !== null || input.startTurn === false) channel.push(userMessage(input.prompt))
    const approvals = createPendingRequestRegistry<PermissionResult | null>(null)
    const dialogs = createPendingRequestRegistry<UserDialogResult>({ behavior: 'cancelled' })
    let stopped = false
    let retries = 0
    const session = { current: input.session }
    const query = {
      current: createQuery({ input, channel, approvals, dialogs, sendBack, session }),
    }
    const recover = () => {
      if (stopped) return
      const canRetry = session.current !== null && retries === 0
      if (!canRetry) {
        sendBack({ type: 'SDK failed' })
        return
      }
      retries += 1
      sendBack({ type: 'Channel lost' })
      query.current = createQuery({ input, channel, approvals, dialogs, sendBack, session })
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
      handleEvent({ approvals, channel, dialogs, event, query, session }),
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

// The SDK has no 'manual' permission mode; the app's default Turn mode maps to the SDK's own
// default instead. Every other mode value is already spelled identically in both vocabularies.
function permissionModeFor(mode: ClaudeTurnSetup['mode']): PermissionMode {
  return mode === 'manual' ? 'default' : (mode as PermissionMode)
}

function createQuery(options: {
  input: ClaudeSessionInput
  channel: ReturnType<typeof createStreamInputChannel>
  approvals: ReturnType<typeof createPendingRequestRegistry<PermissionResult | null>>
  dialogs: ReturnType<typeof createPendingRequestRegistry<UserDialogResult>>
  session: { current: ClaudeSessionInput['session'] }
  sendBack: (event: ClaudeSessionEvent) => void
}): Query {
  const { input, channel, approvals, dialogs, sendBack, session } = options
  return input.createQuery({
    prompt: channel.iterable,
    cwd: input.cwd,
    resume: session.current?.nativeId,
    model: input.setup?.model,
    effort: input.setup?.effort as EffortLevel | undefined,
    permissionMode: input.setup === undefined ? undefined : permissionModeFor(input.setup.mode),
    canUseTool: (toolName, _toolInput, options) => {
      sendBack({
        type: 'Approval requested',
        approval: {
          id: options.toolUseID,
          turnId: options.toolUseID,
          toolCallId: options.toolUseID,
          summary: toolName,
        },
      })
      return approvals.register(options.toolUseID)
    },
    onUserDialog: (request, options) => {
      sendBack({
        type: 'Question requested',
        question: { id: options.requestId, turnId: options.requestId, prompt: request.dialogKind },
      })
      return dialogs.register(options.requestId)
    },
  })
}
