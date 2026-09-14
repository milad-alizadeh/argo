// Whether the composer has a real Session yet, and what it is keyed on until it does
// (CONTEXT.md L2 · Model and Effort). Every surface that used to re-derive "is there a
// Session yet" from `selectedSessionId !== null` switches on this instead.
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

export function composerIdentityKey(identity: ComposerIdentity): string {
  return identity.kind === 'session'
    ? identity.sessionId
    : `new:${identity.projectId ?? 'unselected'}`
}
