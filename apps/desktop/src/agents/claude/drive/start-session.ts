import { requestIdentifier } from '@/boundary'
import {
  type ClaudeSessionStartReply,
  claudeSessionStartRequestSchema,
  sessionError,
} from '@/core/sessions/contract'

import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './drive-channel'

export type ClaudeSessionStarter = Pick<ClaudeSessionDriver, 'start'>

export function startClaudeSession(
  value: unknown,
  starter: ClaudeSessionStarter,
): ClaudeSessionStartReply {
  const requestId = requestIdentifier(value)
  const parsed = claudeSessionStartRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', requestId)
  const request = parsed.data
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
