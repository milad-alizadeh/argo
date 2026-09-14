import type { SessionRenameRequest } from '@/core/sessions/contract'
import { driveSessionError } from '@/core/sessions/contract'
import type { CodexSessionDriver } from './codex-session-driver'

export async function renameCodexSession(
  request: SessionRenameRequest,
  driver: Pick<CodexSessionDriver, 'rename'>,
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
  } catch {
    return driveSessionError('not-drivable', 'codex', request.requestId)
  }
}
