import type {
  ClaudeSessionInterruptRequest,
  ClaudeSessionSendReply,
  ClaudeSessionSendRequest,
} from '@/core/sessions/contract'
import { sessionError } from '@/core/sessions/contract'
import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'

type ClaudeSessionDrive = Pick<ClaudeSessionDriver, 'interrupt' | 'send'>

export async function sendClaudeSession(
  request: ClaudeSessionSendRequest,
  driver: ClaudeSessionDrive,
): Promise<ClaudeSessionSendReply> {
  return accept(request, () =>
    driver.send(request.sessionId, { prompt: request.prompt, setup: request.setup }),
  )
}

export async function interruptClaudeSession(
  request: ClaudeSessionInterruptRequest,
  driver: ClaudeSessionDrive,
): Promise<ClaudeSessionSendReply> {
  return accept(request, () => driver.interrupt(request.sessionId))
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
