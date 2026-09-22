import type { PermissionResult, SDKMessage, UserDialogResult } from '@anthropic-ai/claude-agent-sdk'
import { fromCallback } from 'xstate'
import { createPendingRequestRegistry } from '@/harnesses/claude/agent-sdk/pending-request-registry'
import {
  createStreamInputChannel,
  userMessage,
} from '@/harnesses/claude/agent-sdk/stream-input-channel'
import type { ClaudeSessionEvent, ClaudeSessionInput } from '@/harnesses/claude/agent-sdk/types'

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
      canUseTool: (_toolName, _toolInput, options) => approvals.register(options.toolUseID),
      onUserDialog: (_request, options) => dialogs.register(options.requestId),
    })
    let stopped = false

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

    receive((event: ClaudeSessionEvent) => {
      if (event.type === 'Send' || event.type === 'Steer') {
        channel.push(userMessage(event.prompt))
      }
      if (event.type === 'Interrupt') void query.interrupt()
      if (event.type === 'Decide') {
        approvals.resolve(
          event.approvalId,
          event.decision === 'approve'
            ? { behavior: 'allow' }
            : { behavior: 'deny', message: 'Rejected by user' },
        )
      }
      if (event.type === 'Answer') {
        dialogs.resolve(event.questionId, { behavior: 'completed', result: event.answer })
      }
      if (event.type === 'Rename') {
        // Fire-and-forget: the CLI's own JSONL write, not part of the SDK message stream. A
        // failure leaves the projection's title unchanged rather than tearing down the session.
        void input.renameSession(input.session.nativeId, event.title)
      }
    })

    return () => {
      stopped = true
      approvals.cancelAll()
      dialogs.cancelAll()
      channel.close()
      query.close()
    }
  },
)
