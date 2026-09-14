import type { ClaudeSessionStartReply, ClaudeSessionStartRequest } from '@/core/sessions/contract'
import { sessionError } from '@/core/sessions/contract'

import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'

export type ClaudeSessionStarter = Pick<ClaudeSessionDriver, 'start'>

export function startClaudeSession(
  request: ClaudeSessionStartRequest,
  starter: ClaudeSessionStarter,
): ClaudeSessionStartReply {
  try {
    return {
      version: 1,
      type: 'session.claude.started',
      requestId: request.requestId,
      sessionId: starter.start({ cwd: request.cwd, prompt: request.prompt, setup: request.setup }),
    }
  } catch (error) {
    const code = error instanceof ClaudeSessionDriverError ? error.code : 'launch-failed'
    return sessionError(code, request.requestId)
  }
}
