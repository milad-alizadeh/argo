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
