// Shared by every drive action that resolves a Session's owner before acting on it (#2025/#2026).

import { driveSessionError, type SessionAcceptedReply, sessionError } from './contract'
import type {
  DriveFailureCode,
  SessionDriveAdapter,
  SessionDriveAdapters,
} from './session-drive-adapter'
import { isDriveCli } from './session-error'

export function driveFailureReply(cli: string, failure: DriveFailureCode, requestId: string) {
  if (failure === 'missing-session') return sessionError('missing-session', requestId)
  return driveSessionError(failure, isDriveCli(cli) ? cli : 'claude', requestId)
}

export async function ownedAdapter(
  adapters: SessionDriveAdapters,
  ownerCliFor: (sessionId: string) => Promise<string | undefined>,
  sessionId: string,
) {
  const cli = await ownerCliFor(sessionId)
  if (cli === undefined) return undefined
  const adapter = adapters[cli]
  return adapter === undefined ? undefined : { adapter, cli }
}

// The shape shared by every owner-routed drive action that answers with only `session.accepted`
// or a failure: compact, handoff and interrupt differ only in which adapter method they call.
export async function ownedAcceptedReply(call: {
  adapters: SessionDriveAdapters
  ownerCliFor: (sessionId: string) => Promise<string | undefined>
  request: { sessionId: string; requestId: string }
  act: (adapter: SessionDriveAdapter) => Promise<{ error: DriveFailureCode } | object>
}): Promise<SessionAcceptedReply> {
  const { adapters, ownerCliFor, request, act } = call
  const owned = await ownedAdapter(adapters, ownerCliFor, request.sessionId)
  if (owned === undefined) return sessionError('missing-session', request.requestId)
  const result = await act(owned.adapter)
  if ('error' in result) return driveFailureReply(owned.cli, result.error, request.requestId)
  return {
    version: 1,
    type: 'session.accepted',
    requestId: request.requestId,
    sessionId: request.sessionId,
  }
}
