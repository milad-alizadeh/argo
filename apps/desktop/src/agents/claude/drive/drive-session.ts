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

function requestIdOf(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('requestId' in value)) return null
  return typeof value.requestId === 'string' ? value.requestId : null
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
  return sessionError('invalid-request', requestIdOf(value))
}
