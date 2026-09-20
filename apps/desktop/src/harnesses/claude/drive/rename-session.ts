import type { SessionRenameRequest } from '@/domains/sessions/contract/contract'
import { driveSessionError, sessionError } from '@/domains/sessions/contract/contract'
import type { ClaudeSessionDriver } from '@/harnesses/claude/drive/claude-session-driver'
import { ClaudeSessionDriverError } from '@/harnesses/claude/drive/driver-error'

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
    if (error instanceof ClaudeSessionDriverError && error.code === 'missing-session') {
      return sessionError('missing-session', request.requestId)
    }
    return driveSessionError('not-drivable', 'claude', request.requestId)
  }
}
