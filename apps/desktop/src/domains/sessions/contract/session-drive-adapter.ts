// One shape every Harness's drive adapter fills in (ADR-0024, #2030). Shared code calls only this
// port; it never branches on which Harness it is talking to.
import type { SessionAttachmentInput } from '@/domains/sessions/contract/drive/attachments-contract'
import type { Permission, PermissionDecision } from '@/domains/sessions/contract/drive/permission'
import type { QuestionAnswer } from '@/domains/sessions/contract/drive/question'
import type { DriveSessionErrorCode } from '@/domains/sessions/contract/model/session-error'

export type DriveFailureCode = DriveSessionErrorCode | 'missing-session'
export type DriveFailure = { error: DriveFailureCode }
export type DriveOk = { ok: true }

export type SessionDriveAdapter = {
  harness: string
  failureMessage(code: DriveSessionErrorCode): string
  // A duck-typed Zod schema: lets Claude plug in its Turn-setup vocabulary and Codex refuse any
  // Turn setup at all (#1885 is out of scope), without the router knowing either shape.
  turnSetupSchema: { safeParse: (value: unknown) => { success: boolean } }
  start(request: {
    cwd: string
    prompt: string
    setup: unknown
    attachments: SessionAttachmentInput[]
  }): Promise<{ sessionId: string } | DriveFailure>
  send(request: {
    sessionId: string
    prompt: string
    setup: unknown
    attachments: SessionAttachmentInput[]
  }): Promise<DriveOk | DriveFailure>
  steer?(request: {
    sessionId: string
    prompt: string
    attachments: SessionAttachmentInput[]
  }): Promise<DriveOk | DriveFailure>
  interrupt(request: { sessionId: string }): Promise<DriveOk | DriveFailure>
  compact(request: { sessionId: string }): Promise<DriveOk | DriveFailure>
  handoff(request: { sessionId: string }): Promise<DriveOk | DriveFailure>
  readPermission(request: { sessionId: string }): Promise<{ permission: Permission | null }>
  decidePermission(request: {
    sessionId: string
    permissionId: string
    decision: PermissionDecision
  }): Promise<DriveOk | DriveFailure>
  decideQuestion(request: {
    sessionId: string
    questionId: string
    answers: QuestionAnswer[]
  }): Promise<DriveOk | DriveFailure>
}

export type SessionDriveAdapters = Record<string, SessionDriveAdapter>
