// Whether the composer has a real Session yet, and what it is keyed on until it does
// (CONTEXT.md L2 · Model and Effort).
export type ComposerIdentity =
  | { kind: 'draft'; projectId: string | null }
  | { kind: 'session'; sessionId: string }

export function composerIdentityOf(
  selectedSessionId: string | null,
  projectId: string | null,
): ComposerIdentity {
  if (selectedSessionId === null) return { kind: 'draft', projectId }
  return { kind: 'session', sessionId: selectedSessionId }
}

export function composerIdentityKey(identity: ComposerIdentity): string {
  switch (identity.kind) {
    case 'draft':
      return `new:${identity.projectId ?? 'unselected'}`
    case 'session':
      return identity.sessionId
  }
}
