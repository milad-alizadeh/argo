import type { CodexSessionStartReply, CodexSessionStartRequest } from '@/core/sessions/contract'
import { sessionError } from '@/core/sessions/contract'

import { CodexSessionDriverError } from './codex-session-driver'

export type CodexSessionStarter = {
  start: (request: { cwd: string; prompt: string }) => Promise<string>
}

export async function startCodexSession(
  request: CodexSessionStartRequest,
  starter: CodexSessionStarter,
): Promise<CodexSessionStartReply> {
  try {
    const sessionId = await starter.start({ cwd: request.cwd, prompt: request.prompt })
    return { version: 1, type: 'session.codex.started', requestId: request.requestId, sessionId }
  } catch (error) {
    const code = error instanceof CodexSessionDriverError ? error.code : 'codex-launch-failed'
    return sessionError(code, request.requestId)
  }
}
