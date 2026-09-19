// The one shared drive router (ADR-0024, #2030): `start` routes by the named CLI, every other
// operation by the Session's owner, resolved through the reader's own lookup (#2025/#2026).

import {
  type SessionAcceptedReply,
  type SessionCompactRequest,
  type SessionHandoffRequest,
  type SessionInterruptRequest,
  type SessionPermissionDecisionRequest,
  type SessionPermissionReply,
  type SessionPermissionRequest,
  type SessionQuestionDecisionRequest,
  type SessionSendRequest,
  type SessionStartReply,
  type SessionStartRequest,
  sessionError,
} from '@/domains/sessions/contract/contract'
import { driveSessionError, isDriveCli } from '@/domains/sessions/contract/session-error'
import type {
  DriveFailureCode,
  SessionDriveAdapter,
  SessionDriveAdapters,
} from '@/domains/sessions/main/session-drive-adapter'

export type OwnerContext = {
  adapters: SessionDriveAdapters
  ownerCliFor: (sessionId: string) => Promise<string | undefined>
}
type Owned = { adapter: SessionDriveAdapter; cli: string }

function driveFailureReply(cli: string, failure: DriveFailureCode, requestId: string) {
  if (failure === 'missing-session') return sessionError('missing-session', requestId)
  return driveSessionError(failure, isDriveCli(cli) ? cli : 'claude', requestId)
}

async function ownedAdapter(context: OwnerContext, sessionId: string): Promise<Owned | undefined> {
  const cli = await context.ownerCliFor(sessionId)
  if (cli === undefined) return undefined
  const adapter = context.adapters[cli]
  return adapter === undefined ? undefined : { adapter, cli }
}

// Every operation but `start` runs against the Session's own owner, then reports the shared
// `accepted` reply or the failure the adapter named — the shape every operation below shares.
async function ownedAccepted<T>(
  context: OwnerContext,
  request: { sessionId: string; requestId: string },
  run: (owned: Owned) => Promise<{ error: DriveFailureCode } | T>,
): Promise<SessionAcceptedReply> {
  const owned = await ownedAdapter(context, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  const result = await run(owned)
  if (result !== null && typeof result === 'object' && 'error' in result) {
    return driveFailureReply(owned.cli, result.error, request.requestId)
  }
  return {
    version: 1,
    type: 'session.accepted',
    requestId: request.requestId,
    sessionId: request.sessionId,
  }
}

export async function startSession(
  request: SessionStartRequest,
  adapters: SessionDriveAdapters,
): Promise<SessionStartReply> {
  const adapter = adapters[request.cli]
  if (adapter === undefined) return sessionError('invalid-request', request.requestId)
  if (!adapter.turnSetupSchema.safeParse(request.setup).success) {
    return sessionError('invalid-request', request.requestId)
  }
  const result = await adapter.start({
    cwd: request.cwd,
    prompt: request.prompt,
    setup: request.setup,
    attachments: request.attachments ?? [],
  })
  if ('error' in result) return driveFailureReply(request.cli, result.error, request.requestId)
  return {
    version: 1,
    type: 'session.started',
    requestId: request.requestId,
    sessionId: result.sessionId,
  }
}

export async function sendSession(
  request: SessionSendRequest,
  context: OwnerContext,
): Promise<SessionAcceptedReply> {
  const owned = await ownedAdapter(context, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  if (!owned.adapter.turnSetupSchema.safeParse(request.setup).success) {
    return sessionError('invalid-request', request.requestId)
  }
  return ownedAccepted(context, request, (owned) =>
    owned.adapter.send({
      sessionId: request.sessionId,
      prompt: request.prompt,
      setup: request.setup,
      attachments: request.attachments ?? [],
    }),
  )
}

// interrupt/compact/handoff all reduce to the same shape: hand the Session id to the named
// adapter method, no other arguments.
function singleArgAccepted(
  operation: 'interrupt' | 'compact' | 'handoff',
  request: { sessionId: string; requestId: string },
  context: OwnerContext,
): Promise<SessionAcceptedReply> {
  return ownedAccepted(context, request, (owned) =>
    owned.adapter[operation]({ sessionId: request.sessionId }),
  )
}

export const interruptSession = (request: SessionInterruptRequest, context: OwnerContext) =>
  singleArgAccepted('interrupt', request, context)

export const compactSession = (request: SessionCompactRequest, context: OwnerContext) =>
  singleArgAccepted('compact', request, context)

export const handoffSession = (request: SessionHandoffRequest, context: OwnerContext) =>
  singleArgAccepted('handoff', request, context)

export async function readSessionPermission(
  request: SessionPermissionRequest,
  context: OwnerContext,
): Promise<SessionPermissionReply> {
  const owned = await ownedAdapter(context, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  const { permission } = await owned.adapter.readPermission({ sessionId: request.sessionId })
  return {
    version: 1,
    type: 'session.permission.read',
    requestId: request.requestId,
    sessionId: request.sessionId,
    permission,
  }
}

export function decideSessionPermission(
  request: SessionPermissionDecisionRequest,
  context: OwnerContext,
): Promise<SessionAcceptedReply> {
  return ownedAccepted(context, request, (owned) =>
    owned.adapter.decidePermission({
      sessionId: request.sessionId,
      permissionId: request.permissionId,
      decision: request.decision,
    }),
  )
}

export function decideSessionQuestion(
  request: SessionQuestionDecisionRequest,
  context: OwnerContext,
): Promise<SessionAcceptedReply> {
  return ownedAccepted(context, request, (owned) =>
    owned.adapter.decideQuestion({
      sessionId: request.sessionId,
      questionId: request.questionId,
      answers: request.answers,
    }),
  )
}
