import { requestIdentifier } from '@/boundary'
import {
  type ClaudeSessionInterruptReply,
  type ClaudeSessionSendReply,
  claudeSessionInterruptRequestSchema,
  claudeSessionSendRequestSchema,
  sessionError,
} from '@/core/sessions/contract'

type ClaudeSessionDrive = {
  interrupt: (sessionId: string) => void
  send: (sessionId: string, prompt: string) => void
}

export function driveClaudeSession(
  value: unknown,
  driver: ClaudeSessionDrive,
): ClaudeSessionSendReply | ClaudeSessionInterruptReply {
  const send = claudeSessionSendRequestSchema.safeParse(value)
  if (send.success) {
    const request = send.data
    try {
      driver.send(request.sessionId, request.prompt)
      return {
        version: 1,
        type: 'session.claude.accepted',
        requestId: request.requestId,
        sessionId: request.sessionId,
      }
    } catch {
      return sessionError('not-drivable', request.requestId)
    }
  }
  const interrupt = claudeSessionInterruptRequestSchema.safeParse(value)
  if (interrupt.success) {
    const request = interrupt.data
    try {
      driver.interrupt(request.sessionId)
      return {
        version: 1,
        type: 'session.claude.accepted',
        requestId: request.requestId,
        sessionId: request.sessionId,
      }
    } catch {
      return sessionError('not-drivable', request.requestId)
    }
  }
  return sessionError('invalid-request', requestIdentifier(value))
}
