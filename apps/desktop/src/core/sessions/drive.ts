// The one shared drive router (ADR-0024, #2030). `start` routes by the request's named CLI;
// every other drive operation routes by the Session's owner, resolved through the reader's own
// owner lookup (#2025/#2026) rather than a second lookup shared code would have to maintain.
import { isDriveCli } from './session-error'
import type { DriveFailureCode, SessionDriveAdapters } from './session-drive-adapter'
import {
  type SessionAcceptedReply,
  type SessionInterruptRequest,
  type SessionPermissionDecisionRequest,
  type SessionPermissionReply,
  type SessionPermissionRequest,
  type SessionSendRequest,
  type SessionStartReply,
  type SessionStartRequest,
  driveSessionError,
  sessionError,
} from './contract'

function driveFailureReply(cli: string, failure: DriveFailureCode, requestId: string) {
  if (failure === 'missing-session') return sessionError('missing-session', requestId)
  return driveSessionError(failure, isDriveCli(cli) ? cli : 'claude', requestId)
}

async function ownedAdapter(
  adapters: SessionDriveAdapters,
  ownerCliFor: (sessionId: string) => Promise<string | undefined>,
  sessionId: string,
) {
  const cli = await ownerCliFor(sessionId)
  if (cli === undefined) return undefined
  const adapter = adapters[cli]
  return adapter === undefined ? undefined : { adapter, cli }
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
  const result = await adapter.start({ cwd: request.cwd, prompt: request.prompt, setup: request.setup })
  if ('error' in result) return driveFailureReply(request.cli, result.error, request.requestId)
  return { version: 1, type: 'session.started', requestId: request.requestId, sessionId: result.sessionId }
}

export async function sendSession(
  request: SessionSendRequest,
  adapters: SessionDriveAdapters,
  ownerCliFor: (sessionId: string) => Promise<string | undefined>,
): Promise<SessionAcceptedReply> {
  const owned = await ownedAdapter(adapters, ownerCliFor, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  if (!owned.adapter.turnSetupSchema.safeParse(request.setup).success) {
    return sessionError('invalid-request', request.requestId)
  }
  const result = await owned.adapter.send({
    sessionId: request.sessionId,
    prompt: request.prompt,
    setup: request.setup,
  })
  if ('error' in result) return driveFailureReply(owned.cli, result.error, request.requestId)
  return { version: 1, type: 'session.accepted', requestId: request.requestId, sessionId: request.sessionId }
}

export async function interruptSession(
  request: SessionInterruptRequest,
  adapters: SessionDriveAdapters,
  ownerCliFor: (sessionId: string) => Promise<string | undefined>,
): Promise<SessionAcceptedReply> {
  const owned = await ownedAdapter(adapters, ownerCliFor, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  const result = await owned.adapter.interrupt({ sessionId: request.sessionId })
  if ('error' in result) return driveFailureReply(owned.cli, result.error, request.requestId)
  return { version: 1, type: 'session.accepted', requestId: request.requestId, sessionId: request.sessionId }
}

export async function readSessionPermission(
  request: SessionPermissionRequest,
  adapters: SessionDriveAdapters,
  ownerCliFor: (sessionId: string) => Promise<string | undefined>,
): Promise<SessionPermissionReply> {
  const owned = await ownedAdapter(adapters, ownerCliFor, request.sessionId)
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

export async function decideSessionPermission(
  request: SessionPermissionDecisionRequest,
  adapters: SessionDriveAdapters,
  ownerCliFor: (sessionId: string) => Promise<string | undefined>,
): Promise<SessionAcceptedReply> {
  const owned = await ownedAdapter(adapters, ownerCliFor, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  const result = await owned.adapter.decidePermission({
    sessionId: request.sessionId,
    permissionId: request.permissionId,
    decision: request.decision,
  })
  if ('error' in result) return driveFailureReply(owned.cli, result.error, request.requestId)
  return { version: 1, type: 'session.accepted', requestId: request.requestId, sessionId: request.sessionId }
}
