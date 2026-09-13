import type {
  CodexSessionInterruptRequest,
  CodexSessionSendReply,
  CodexSessionSendRequest,
} from '@/core/sessions/contract'
import { sessionError } from '@/core/sessions/contract'

type CodexSessionDrive = {
  interrupt: (sessionId: string) => Promise<void>
  send: (sessionId: string, prompt: string) => Promise<void>
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
  } catch {
    return sessionError('codex-not-drivable', request.requestId)
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
  } catch {
    return sessionError('codex-not-drivable', request.requestId)
  }
}
