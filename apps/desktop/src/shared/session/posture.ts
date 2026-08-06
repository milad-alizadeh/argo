// The Session's class and posture (CONTEXT.md L2, ADR-0013). The only STORED classification is
// `managed | external` — there are no kinds. `orphaned` is an honest THIRD POSTURE of that same
// axis rather than a fourth stored kind: managed-ness dies with the owning Argo process and
// cannot be re-adopted, so a managed Session whose owner is gone reads as orphaned and drops to
// observation-only.

export const SESSION_CLASSES = ['managed', 'external'] as const

export type SessionClass = (typeof SESSION_CLASSES)[number]

export const SESSION_POSTURES = ['managed', 'external', 'orphaned'] as const

export type SessionPosture = (typeof SESSION_POSTURES)[number]

/**
 * Resolve the rendered posture from the stored class plus whether Argo still owns the session.
 * `ownerAlive` is meaningless for an external Session (Argo never owned one), so it is read
 * only for `managed`.
 */
export function sessionPosture(sessionClass: SessionClass, ownerAlive: boolean): SessionPosture {
  if (sessionClass === 'external') return 'external'
  return ownerAlive ? 'managed' : 'orphaned'
}

/**
 * Whether Argo may claim a DIRECT/CONVENTION-tier fact about this Session. Only a live managed
 * Session has the PTY and the companion channel; external and orphaned are observation-only, so
 * every fact about them degrades to DERIVED.
 */
export function isSteerable(posture: SessionPosture): boolean {
  return posture === 'managed'
}
