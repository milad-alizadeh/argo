import { requestIdentifier } from '@/boundary'
import {
  type ClaudeSessionInterruptReply,
  type ClaudeSessionSendReply,
  claudeSessionInterruptRequestSchema,
  claudeSessionSendRequestSchema,
  sessionError,
} from '@/core/sessions/contract'
import { ClaudeSessionDriverError } from './drive-channel'

type ClaudeSessionDrive = {
  interrupt: (sessionId: string) => void
  send: (sessionId: string, prompt: string) => Promise<void>
}

export async function driveClaudeSession(
  value: unknown,
  driver: ClaudeSessionDrive,
): Promise<ClaudeSessionSendReply | ClaudeSessionInterruptReply> {
  const send = claudeSessionSendRequestSchema.safeParse(value)
  if (send.success) {
    const request = send.data
    return accept(request, () => driver.send(request.sessionId, request.prompt))
  }
  const interrupt = claudeSessionInterruptRequestSchema.safeParse(value)
  if (interrupt.success) {
    const request = interrupt.data
    return accept(request, () => driver.interrupt(request.sessionId))
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
