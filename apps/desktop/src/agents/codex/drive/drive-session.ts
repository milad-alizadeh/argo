import { requestIdentifier } from '@/boundary'
import {
  type CodexSessionInterruptReply,
  type CodexSessionSendReply,
  codexSessionInterruptRequestSchema,
  codexSessionSendRequestSchema,
  type SessionRenameReply,
  sessionError,
  sessionRenameRequestSchema,
} from '@/core/sessions/contract'

type CodexSessionDrive = {
  interrupt: (sessionId: string) => Promise<void>
  rename: (sessionId: string, name: string) => Promise<string>
  send: (sessionId: string, prompt: string) => Promise<void>
}

export async function driveCodexSession(
  value: unknown,
  driver: CodexSessionDrive,
): Promise<CodexSessionSendReply | CodexSessionInterruptReply | SessionRenameReply> {
  const rename = sessionRenameRequestSchema.safeParse(value)
  if (rename.success) {
    const request = rename.data
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
  const send = codexSessionSendRequestSchema.safeParse(value)
  if (send.success) {
    const request = send.data
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
  const interrupt = codexSessionInterruptRequestSchema.safeParse(value)
  if (interrupt.success) {
    const request = interrupt.data
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
  return sessionError('invalid-request', requestIdentifier(value))
}
