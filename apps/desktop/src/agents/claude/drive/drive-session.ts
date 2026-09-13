import { requestIdentifier } from '@/boundary'
import {
  type ClaudeSessionInterruptReply,
  type ClaudeSessionSendReply,
  claudeSessionCompactRequestSchema,
  claudeSessionInterruptRequestSchema,
  claudeSessionSendRequestSchema,
  sessionError,
} from '@/core/sessions/contract'
import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'

type ClaudeSessionDrive = Pick<ClaudeSessionDriver, 'compact' | 'interrupt' | 'send'>

export async function driveClaudeSession(
  value: unknown,
  driver: ClaudeSessionDrive,
): Promise<ClaudeSessionSendReply | ClaudeSessionInterruptReply> {
  const send = claudeSessionSendRequestSchema.safeParse(value)
  if (send.success) {
    const request = send.data
    return accept(request, () =>
      driver.send(request.sessionId, { prompt: request.prompt, setup: request.setup }),
    )
  }
  const interrupt = claudeSessionInterruptRequestSchema.safeParse(value)
  if (interrupt.success) {
    const request = interrupt.data
    return accept(request, () => driver.interrupt(request.sessionId))
  }
  const compact = claudeSessionCompactRequestSchema.safeParse(value)
  if (compact.success) {
    const request = compact.data
    return accept(request, () => driver.compact(request.sessionId))
  }
  return sessionError('invalid-request', requestIdentifier(value))
}

async function accept(
  request: { requestId: string; sessionId: string },
  drive: () => Promise<void> | void,
): Promise<ClaudeSessionSendReply> {
  try {
    await drive()
    return {
      version: 1,
      type: 'session.claude.accepted',
      requestId: request.requestId,
      sessionId: request.sessionId,
    }
  } catch (error) {
    // A refusal the driver names reaches the composer as itself; anything else lost the channel.
    const code = error instanceof ClaudeSessionDriverError ? error.code : 'not-drivable'
    return sessionError(code, request.requestId)
  }
}
