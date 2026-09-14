import type {
  CodexSessionInterruptRequest,
  CodexSessionSendReply,
  CodexSessionSendRequest,
  SessionRenameReply,
  SessionRenameRequest,
} from '@/core/sessions/contract'
import { sessionError } from '@/core/sessions/contract'

type CodexSessionDrive = {
  interrupt: (sessionId: string) => Promise<void>
  send: (sessionId: string, prompt: string) => Promise<void>
  rename: (sessionId: string, name: string) => Promise<string>
}

// `codex app-server` refuses a thread already active in another process (its own client or the
// standalone Codex app) with a JSON-RPC error naming that fact; every other refusal reads
// `codex-not-drivable`. The exact wording still needs a live repro against a held Session (#2053)
// to replace this heuristic with the real one.
const ACTIVE_ELSEWHERE = /already active|in use|held by|another (client|session|instance)/i

function codexErrorCode(error: unknown): 'codex-held-elsewhere' | 'codex-not-drivable' {
  const message = error instanceof Error ? error.message : ''
  return ACTIVE_ELSEWHERE.test(message) ? 'codex-held-elsewhere' : 'codex-not-drivable'
}

export async function sendCodexSession(
  request: CodexSessionSendRequest,
  driver: CodexSessionDrive,
): Promise<CodexSessionSendReply> {
  try {
    await driver.send(request.sessionId, request.prompt)
    return {
      version: 1,
      type: 'session.codex.accepted',
      requestId: request.requestId,
      sessionId: request.sessionId,
    }
  } catch (error) {
    console.error('Argo could not send to Codex Session', request.sessionId, error)
    return sessionError(codexErrorCode(error), request.requestId)
  }
}

export async function interruptCodexSession(
  request: CodexSessionInterruptRequest,
  driver: CodexSessionDrive,
): Promise<CodexSessionSendReply> {
  try {
    await driver.interrupt(request.sessionId)
    return {
      version: 1,
      type: 'session.codex.accepted',
      requestId: request.requestId,
      sessionId: request.sessionId,
    }
  } catch (error) {
    console.error('Argo could not interrupt Codex Session', request.sessionId, error)
    return sessionError(codexErrorCode(error), request.requestId)
  }
}

export async function renameCodexSession(
  request: SessionRenameRequest,
  driver: CodexSessionDrive,
): Promise<SessionRenameReply> {
  try {
    const title = await driver.rename(request.sessionId, request.name)
    return {
      version: 1,
      type: 'session.renamed',
      requestId: request.requestId,
      sessionId: request.sessionId,
      title,
    }
  } catch {
    return sessionError('codex-not-drivable', request.requestId)
  }
}
