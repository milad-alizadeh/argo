import type * as SessionContract from '@/domains/sessions/contract/ipc'
import { sessionError } from '@/domains/sessions/contract/ipc'
import { driveSessionErrorWithMessage } from '@/domains/sessions/contract/model'
import type {
  DriveFailureCode,
  SessionDriveAdapter,
  SessionDriveAdapters,
} from '@/domains/sessions/contract/session-drive-adapter'

export type OwnerContext = {
  adapters: SessionDriveAdapters
  ownerHarnessFor: (sessionId: string) => Promise<string | undefined>
  sessionCwdFor: (sessionId: string) => Promise<string | undefined>
}
type Owned = { adapter: SessionDriveAdapter; harness: string }

function driveFailureReply({
  adapter,
  failure,
  requestId,
  message,
}: {
  adapter: SessionDriveAdapter
  failure: DriveFailureCode
  requestId: string
  message?: string
}) {
  if (failure === 'missing-session') return sessionError('missing-session', requestId)
  return driveSessionErrorWithMessage(failure, {
    harness: adapter.harness,
    requestId,
    message: message ?? adapter.failureMessage(failure),
  })
}
async function ownedAdapter(context: OwnerContext, sessionId: string): Promise<Owned | undefined> {
  const harness = await context.ownerHarnessFor(sessionId)
  if (harness === undefined) return undefined
  const adapter = context.adapters[harness]
  return adapter === undefined ? undefined : { adapter, harness }
}
export async function ownedAccepted<T>(
  context: OwnerContext,
  request: { sessionId: string; requestId: string },
  run: (owned: Owned) => Promise<{ error: DriveFailureCode; message?: string } | T>,
): Promise<SessionContract.SessionAcceptedReply> {
  const owned = await ownedAdapter(context, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  const result = await run(owned)
  if (result !== null && typeof result === 'object' && 'error' in result) {
    return driveFailureReply({
      adapter: owned.adapter,
      failure: result.error,
      requestId: request.requestId,
      message: result.message,
    })
  }
  return {
    version: 1,
    type: 'session.accepted',
    requestId: request.requestId,
    sessionId: request.sessionId,
  }
}
export async function startSession(
  request: SessionContract.SessionStartRequest,
  adapters: SessionDriveAdapters,
): Promise<SessionContract.SessionStartReply> {
  const adapter = adapters[request.harness]
  if (adapter === undefined) return sessionError('invalid-request', request.requestId)
  if (!adapter.turnSetupSchema.safeParse(request.setup).success) {
    return sessionError('invalid-request', request.requestId)
  }
  const result = await adapter.start({
    cwd: request.cwd,
    prompt: request.prompt,
    deferInitialTurn: request.deferInitialTurn,
    setup: request.setup,
    attachments: request.attachments ?? [],
  })
  if ('error' in result) {
    return driveFailureReply({
      adapter,
      failure: result.error,
      requestId: request.requestId,
      message: result.message,
    })
  }
  return {
    version: 1,
    type: 'session.started',
    requestId: request.requestId,
    sessionId: result.sessionId,
  }
}
export async function sendSession(
  request: SessionContract.SessionSendRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  const owned = await ownedAdapter(context, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  if (!owned.adapter.turnSetupSchema.safeParse(request.setup).success) {
    return sessionError('invalid-request', request.requestId)
  }
  const cwd = await context.sessionCwdFor(request.sessionId)
  if (cwd === undefined) return sessionError('missing-session', request.requestId)
  return ownedAccepted(context, request, (owned) =>
    owned.adapter.send({
      sessionId: request.sessionId,
      cwd,
      prompt: request.prompt,
      setup: request.setup,
      attachments: request.attachments ?? [],
    }),
  )
}
function singleArgAccepted(
  operation: 'interrupt' | 'compact' | 'handoff',
  request: { sessionId: string; requestId: string },
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  return ownedAccepted(context, request, (owned) =>
    owned.adapter[operation]({ sessionId: request.sessionId }),
  )
}
export const interruptSession = (
  request: SessionContract.SessionInterruptRequest,
  context: OwnerContext,
) => singleArgAccepted('interrupt', request, context)
export const compactSession = (
  request: SessionContract.SessionCompactRequest,
  context: OwnerContext,
) => singleArgAccepted('compact', request, context)
export const handoffSession = (
  request: SessionContract.SessionHandoffRequest,
  context: OwnerContext,
) => singleArgAccepted('handoff', request, context)

export async function readSessionPermission(
  request: SessionContract.SessionPermissionRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionPermissionReply> {
  const owned = await context.ownerHarnessFor(request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  const adapter = context.adapters[owned]
  if (adapter === undefined) return sessionError('missing-session', request.requestId)
  const { permission } = await adapter.readPermission({ sessionId: request.sessionId })
  return {
    version: 1,
    type: 'session.permission.read',
    requestId: request.requestId,
    sessionId: request.sessionId,
    permission,
  }
}

export function decideSessionPermission(
  request: SessionContract.SessionPermissionDecisionRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  return ownedAccepted(context, request, (owned) =>
    owned.adapter.decidePermission({
      sessionId: request.sessionId,
      permissionId: request.permissionId,
      decision: request.decision,
    }),
  )
}

export function decideSessionQuestion(
  request: SessionContract.SessionQuestionDecisionRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  return ownedAccepted(context, request, (owned) =>
    owned.adapter.decideQuestion({
      sessionId: request.sessionId,
      questionId: request.questionId,
      answers: request.answers,
    }),
  )
}

export async function steerSession(
  request: SessionContract.SessionSteerRequest,
  context: OwnerContext,
): Promise<SessionContract.SessionAcceptedReply> {
  const cwd = await context.sessionCwdFor(request.sessionId)
  if (cwd === undefined) return sessionError('missing-session', request.requestId)
  return ownedAccepted(
    context,
    request,
    async (owned) =>
      (await owned.adapter.steer?.({
        sessionId: request.sessionId,
        cwd,
        prompt: request.prompt,
        attachments: request.attachments ?? [],
      })) ?? { error: 'not-drivable' as const },
  )
}
