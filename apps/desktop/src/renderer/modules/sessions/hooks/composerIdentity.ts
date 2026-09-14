import type { SessionRosterRow } from '@/core/sessions/models'
import type { SessionsListed } from '../types'

// Whether the composer has a real Session yet, and what it is keyed on until it does
// (CONTEXT.md L2 · Model and Effort).
export type ComposerIdentity =
  | { kind: 'draft'; projectId: string | null }
  | { kind: 'session'; sessionId: string }

export function composerIdentityOf(
  selectedSessionId: string | null,
  projectId: string | null,
): ComposerIdentity {
  return selectedSessionId === null
    ? { kind: 'draft', projectId }
    : { kind: 'session', sessionId: selectedSessionId }
}

export function findSessionRow(
  roster: SessionsListed | null,
  id: string | null,
): SessionRosterRow | null {
  if (id === null) return null
  return roster?.sessions.find((session) => session.id === id) ?? null
}

export function composerIdentityKey(identity: ComposerIdentity): string {
  return identity.kind === 'session'
    ? identity.sessionId
    : `new:${identity.projectId ?? 'unselected'}`
}
