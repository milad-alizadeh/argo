import { requestIdentifier } from '@/boundary'
import {
  type ClaudeSessionStartReply,
  isClaudeSessionStartRequest,
  sessionError,
} from '@/core/sessions/contract'

import { ClaudeSessionDriverError } from './claude-session-driver'

export type ClaudeSessionStarter = {
  start: (request: { cwd: string; prompt: string }) => string
}

export function startClaudeSession(
  value: unknown,
  starter: ClaudeSessionStarter,
): ClaudeSessionStartReply {
  const requestId = requestIdentifier(value)
  if (!isClaudeSessionStartRequest(value)) return sessionError('invalid-request', requestId)
  try {
    return {
      version: 1,
      type: 'session.claude.started',
      requestId: value.requestId,
      sessionId: starter.start({ cwd: value.cwd, prompt: value.prompt }),
    }
  } catch (error) {
    const code = error instanceof ClaudeSessionDriverError ? error.code : 'launch-failed'
    return sessionError(code, value.requestId)
  }
}
