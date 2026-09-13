import { requestIdentifier } from '@/boundary'
import {
  type ClaudeSessionInterruptReply,
  type ClaudeSessionSendReply,
  claudeSessionInterruptRequestSchema,
  claudeSessionSendRequestSchema,
  sessionError,
} from '@/core/sessions/contract'

import type { ClaudeSessionDriver } from './claude-session-driver'

type ClaudeSessionDrive = Pick<ClaudeSessionDriver, 'interrupt' | 'send'>

export async function driveClaudeSession(
  value: unknown,
  driver: ClaudeSessionDrive,
): Promise<ClaudeSessionSendReply | ClaudeSessionInterruptReply> {
  const send = claudeSessionSendRequestSchema.safeParse(value)
  if (send.success) {
    const request = send.data
    try {
      await driver.send(request.sessionId, { prompt: request.prompt, setup: request.setup })
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
