// The two reads about a Session's background work (#1582): what one Shell has written, and what
// each Subagent spent. Both route through the Session's own owner, and an adapter that records
// neither answers with nothing rather than an error.
import {
  sessionDelegationUsageRequestSchema,
  sessionError,
  sessionShellOutputRequestSchema,
} from './contract'
import { readFailure, versionFailure } from './read-request'
import type { SessionSource } from './session-source'

type OwnerFor = (sessionId: string) => Promise<SessionSource | undefined>

// A Subagent's Feed is read through the same path as a Session's: the owner answers with the
// Subagent's chain in place of its own, and nothing else about the read changes. A driver's live
// overlay is the Session's turn and says nothing about a Subagent, so no overlay is applied.
export function delegationSource(owner: SessionSource, delegationId: string): SessionSource {
  return {
    ...owner,
    overlayFor: undefined,
    readSessionFiles: async (sessionId) =>
      (await owner.readDelegationFiles?.(sessionId, delegationId)) ?? null,
  }
}

export async function shellOutputReply(ownerFor: OwnerFor, value: unknown) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionShellOutputRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const { requestId, sessionId, shellId } = parsed.data
  try {
    const owner = await ownerFor(sessionId)
    if (owner === undefined) return sessionError('missing-session', requestId)
    return {
      version: 1 as const,
      type: 'session.shell.output.read' as const,
      requestId,
      sessionId,
      shellId,
      output: (await owner.readShellOutput?.(sessionId, shellId)) ?? null,
    }
  } catch (error) {
    return sessionError(readFailure(error), requestId)
  }
}

export async function delegationUsageReply(ownerFor: OwnerFor, value: unknown) {
  if (versionFailure(value)) return sessionError('unsupported-version', null)
  const parsed = sessionDelegationUsageRequestSchema.safeParse(value)
  if (!parsed.success) return sessionError('invalid-request', null)
  const { requestId, sessionId } = parsed.data
  try {
    const owner = await ownerFor(sessionId)
    if (owner === undefined) return sessionError('missing-session', requestId)
    return {
      version: 1 as const,
      type: 'session.delegation.usage.read' as const,
      requestId,
      sessionId,
      usage: (await owner.readDelegationUsage?.(sessionId)) ?? [],
    }
  } catch (error) {
    return sessionError(readFailure(error), requestId)
  }
}
