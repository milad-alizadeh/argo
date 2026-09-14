import type {
  CodexSessionInterruptRequest,
  CodexSessionSendReply,
  CodexSessionSendRequest,
} from '@/core/sessions/contract'
import { sessionError } from '@/core/sessions/contract'
import { sessionRenameRequestSchema } from '@/core/sessions/contract'

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

export async function renameCodexSession(value: unknown, driver: CodexSessionDrive) {
  const parsed = sessionRenameRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  try {
    const title = await driver.rename(parsed.data.sessionId, parsed.data.name)
    return { version: 1 as const, type: 'session.renamed' as const, requestId: parsed.data.requestId, sessionId: parsed.data.sessionId, title }
  } catch {
    return sessionError('codex-not-drivable', parsed.data.requestId)
  }
}
