// The Session status ROLLUP (CONTEXT.md L2 · Session status): the one fold every call site that
// computes a Session's status goes through, instead of each restating its own fragment of the
// honesty-tier rule. It takes the transcript-derived floor (`readExternalStatus` in status.ts),
// the Session's posture, and one already-derived managed reading, and returns the one
// SessionStatus. The reading is a SessionStatus too: each adapter translates its own CLI's words
// into that closed set in its own directory, so no wire vocabulary reaches this module.
//
// The tie-break is the degrade-down rule made concrete: `permission` is DIRECT and managed-only,
// so it always wins. Any other managed reading only wins where the floor itself has nothing to
// say (`unknown`) — nothing observed is a different claim from observed to be quiet, and a
// definite floor (`idle`, `asking`, `stopped`) is never overridden by a managed `running` just
// because it is held.

import type { SessionPosture, SessionStatus } from '../contract/models'

export function rollupSessionStatus(
  floor: SessionStatus,
  posture: SessionPosture,
  managed: SessionStatus | null,
): SessionStatus {
  if (posture !== 'managed' || managed === null) return floor
  return managed === 'permission' || floor === 'unknown' ? managed : floor
}
