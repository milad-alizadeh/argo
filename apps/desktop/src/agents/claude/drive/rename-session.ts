import type { SessionRenameRequest } from '@/core/sessions/contract'
import { sessionError } from '@/core/sessions/contract'
import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'

export async function renameClaudeSession(
  request: SessionRenameRequest,
  driver: Pick<ClaudeSessionDriver, 'rename'>,
) {
  try {
    const title = await driver.rename(request.sessionId, request.name)
    return {
      version: 1 as const,
      type: 'session.renamed' as const,
      requestId: request.requestId,
      sessionId: request.sessionId,
      title,
    }
  } catch (error) {
    const code = error instanceof ClaudeSessionDriverError ? error.code : 'not-drivable'
    return sessionError(code, request.requestId)
  }
}
