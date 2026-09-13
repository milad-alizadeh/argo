import {
  type ClaudeSessionInterruptReply,
  type ClaudeSessionSendReply,
  isClaudeSessionInterruptRequest,
  isClaudeSessionSendRequest,
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
  if (isClaudeSessionSendRequest(value)) {
    try {
      driver.send(value.sessionId, value.prompt)
      return {
        version: 1,
        type: 'session.claude.accepted',
        requestId: value.requestId,
        sessionId: value.sessionId,
      }
    } catch {
      return sessionError('not-drivable', value.requestId)
    }
  }
  if (isClaudeSessionInterruptRequest(value)) {
    try {
      driver.interrupt(value.sessionId)
      return {
        version: 1,
        type: 'session.claude.accepted',
        requestId: value.requestId,
        sessionId: value.sessionId,
      }
    } catch {
      return sessionError('not-drivable', value.requestId)
    }
  }
  return sessionError('invalid-request', requestIdOf(value))
}
