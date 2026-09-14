// The Session status ROLLUP (CONTEXT.md L2 · Session status): the one fold every call site that
// computes a Session's status goes through, instead of each restating its own fragment of the
// honesty-tier rule. It takes the transcript-derived floor (`readExternalStatus` in status.ts),
// the Session's posture, and a managed-only CLI signal, and returns the one SessionStatus.
//
// The tie-break is the degrade-down rule made concrete: `permission` is DIRECT and managed-only,
// so it always wins. Any other managed reading only wins where the floor itself has nothing to
// say (`unknown`) — nothing observed is a different claim from observed to be quiet, and a
// definite floor (`idle`, `asking`, `stopped`) is never overridden by a managed `running` just
// because it is held.

import type { SessionPosture, SessionStatus } from './models'

export type CodexStatusReading = { kind: 'thread'; status: SessionStatus } | { kind: 'turn-failed' }

export type ManagedStatusSignal =
  | { cli: 'claude'; pendingPermission: boolean }
  | { cli: 'codex'; reading: CodexStatusReading }
  // Already-derived: a caller (managed-row.ts) reconciling two rows that each ran their own CLI
  // signal through this fold once already needs no second derivation, only the tie-break.
  | SessionStatus

function deriveManagedStatus(signal: ManagedStatusSignal): SessionStatus {
  if (typeof signal === 'string') return signal
  if (signal.cli === 'claude') return signal.pendingPermission ? 'permission' : 'running'
  // A failed Turn is a degrade-down case, not a one-off exception: the protocol has spoken, but
  // not into a word this fold's closed set can stand behind.
  return signal.reading.kind === 'turn-failed' ? 'unknown' : signal.reading.status
}

export function rollupSessionStatus(
  floor: SessionStatus,
  posture: SessionPosture,
  signal: ManagedStatusSignal | null,
): SessionStatus {
  if (posture !== 'managed' || signal === null) return floor
  const managed = deriveManagedStatus(signal)
  return managed === 'permission' || floor === 'unknown' ? managed : floor
}
