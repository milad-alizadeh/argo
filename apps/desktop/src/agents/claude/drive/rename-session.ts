import { requestIdentifier } from '@/boundary'
import { sessionError, sessionRenameRequestSchema } from '@/core/sessions/contract'
import type { ClaudeSessionDriver } from './claude-session-driver'
import { ClaudeSessionDriverError } from './driver-error'

export async function renameClaudeSession(
  value: unknown,
  driver: Pick<ClaudeSessionDriver, 'rename'>,
) {
  const parsed = sessionRenameRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', requestIdentifier(value))
  try {
    const title = await driver.rename(parsed.data.sessionId, parsed.data.name)
    return {
      version: 1 as const,
      type: 'session.renamed' as const,
      requestId: parsed.data.requestId,
      sessionId: parsed.data.sessionId,
      title,
    }
  } catch (error) {
    const code = error instanceof ClaudeSessionDriverError ? error.code : 'not-drivable'
    return sessionError(code, parsed.data.requestId)
  }
}
