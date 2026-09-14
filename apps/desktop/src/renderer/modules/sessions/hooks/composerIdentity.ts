// Whether the composer has a real Session yet, and what it is keyed on until it does
// (CONTEXT.md L2 · Model and Effort).
export type ComposerIdentity =
  | { kind: 'draft'; projectId: string | null }
  // A `session.start` has not been sent for this row yet, but it already has a Roster row and a
  // focus (#2109) — the "+"/Enter dedup point (draft) rather than an established Session (session).
  | { kind: 'pending'; sessionId: string; projectId: string | null }
  | { kind: 'session'; sessionId: string }

export function composerIdentityOf(
  selectedSessionId: string | null,
  projectId: string | null,
  pendingSessionId: string | null,
): ComposerIdentity {
  if (selectedSessionId === null) return { kind: 'draft', projectId }
  if (selectedSessionId === pendingSessionId) {
    return { kind: 'pending', sessionId: selectedSessionId, projectId }
  }
  return { kind: 'session', sessionId: selectedSessionId }
}

export function composerIdentityKey(identity: ComposerIdentity): string {
  switch (identity.kind) {
    case 'draft':
      return `new:${identity.projectId ?? 'unselected'}`
    case 'pending':
    case 'session':
      return identity.sessionId
  }
}
