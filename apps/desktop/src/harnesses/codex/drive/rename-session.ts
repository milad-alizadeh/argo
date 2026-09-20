import type { SessionRenameRequest } from '@/domains/sessions/contract/ipc/contract'
import { driveSessionError } from '@/domains/sessions/contract/ipc/contract'
import type { CodexSessionDriver } from '@/harnesses/codex/drive/codex-session-driver'

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
