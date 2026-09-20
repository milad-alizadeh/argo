import type { ClaudeSessionDriver } from '@/agents/claude/drive/claude-session-driver'
import { ClaudeSessionDriverError } from '@/agents/claude/drive/driver-error'
import type { SessionRenameRequest } from '@/domains/sessions/contract/ipc/contract'
import { driveSessionError, sessionError } from '@/domains/sessions/contract/ipc/contract'

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
